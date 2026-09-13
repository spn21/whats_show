package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/hashicorp/memberlist"
)

type NodeMeta struct {
	Role    string `json:"role"`
	Version string `json:"version”`
	StartAt int64  `json:"start_at“`
}

type BroadcastMessage struct {
	From    string `json:"from"`
	Type    string `json:"type"`
	Payload string `json:"payload"`
	Seq     int64  `json:"seq“`
}

type SimpleBroadcast struct {
	msg    []byte
	notify chan<- struct{}
}

func (b *SimpleBroadcast) Invalidates(other memberlist.Broadcast) bool {
	return false
}

func (b *SimpleBroadcast) Message() []byte {
	return b.msg
}

func (b *SimpleBroadcast) Fininshed() {
	if b.notify != nil {
		close(b.notify)
	}
}

type EventHandler struct {
	mu      sync.RWMutex
	members map[string]NodeMeta
}

func NewEventHandler() *EventHandler {
	return &EventHandler{
		members: make(map[string]NodeMeta),
	}
}

func (h *EventHandler) NotifyJoin(node *memberlist.Node) {
	meta := NodeMeta{}
	if len(node.Meta) > 0 {
		_ = json.Unmarshal(node.Meta, &meta)
	}

	h.mu.Lock()
	h.members[node.Name] = meta
	h.mu.Unlock()
	log.Print("[EVENT] Node joined: %s (%s:%d) role=%s version=%s",
		node.Name, node.Addr, node.Port, meta.Role, meta.Version)
}

func (h *EventHandler) NotifyLeave(node *memberlist.Node) {
	h.mu.Lock()
	delete(h.members, node.Name)
	h.mu.Unlock()
	log.Printf("[EVENT] Node left: %s (%s:%d)", node.Name, node.Addr, node.Port)
}

func (h *EventHandler) NotifyUpdate(node *memberlist.Node) {
	meta := NodeMeta{}
	if len(node.Meta) > 0 {
		_ = json.Unmarshal(node.Meta, &meta)
	}
	h.mu.Lock()
	h.members[node.Name] = meta
	h.mu.Unlock()
	log.Printf("[EVENT] Node updated: %s role = %s version = %s", node.Name, meta.Role, meta.Version)
}

func (h *EventHandler) GetMembers() map[string]NodeMeta {
	h.mu.RLock()
	defer h.mu.RUnlock()
	result := make(map[string]NodeMeta, len(h.members))
	for k, v := range h.members {
		result[k] = v
	}

	return result
}

// memberlist.Delegate

type AppDelegate struct {
	mu         sync.RWMutex
	meta       NodeMeta
	broadcasts *memberlist.TransmitLimitedQueue
	msgCh      chan BroadcastMessage
}

func NewAppDelegate(meta NodeMeta) *AppDelegate {
	return &AppDelegate{
		meta:  meta,
		msgCh: make(chan BroadcastMessage, 64),
	}
}

func (d *AppDelegate) NodeMeta(limit int) []byte {
	d.mu.RLock()
	defer d.mu.RUnlock()
	raw, err := json.Marshal((d.meta))
	if err != nil {
		log.Printf("[WARN] Failed to marshal node meta: %v", err)
		return nil
	}
	if len(raw) > limit {
		log.Printf("[WARN] Node meta size %d exceeds limit %d", len(raw), limit)
		return nil
	}
	return raw
}

func (d *AppDelegate) NotifyMsg(msg []byte) {
	if len(msg) == 0 {
		return
	}

	var bm BroadcastMessage
	if err := json.Unmarshal(msg, &bm); err != nil {
		log.Printf("[WARN] Failed to unmarshal Broadcast message: %v", err)
		return
	}

	select {
	case d.msgCh <- bm:
	default:
		log.Printf("[WARN] Message channel full, dropping message from %s", bm.From)
	}
}

func (d *AppDelegate) GetBroadcasts(overhead, limit int) [][]byte {
	if d.broadcasts == nil {
		return nil
	}

	return d.broadcasts.GetBroadcasts(overhead, limit)
}

// LocalState pull/push
func (d *AppDelegate) LocalState(join bool) []byte {
	d.mu.RLock()
	defer d.mu.RUnlock()
	state := map[string]interface{}{
		"meta":    d.meta,
		"join":    join,
		"time_ms": time.Now().UnixMilli(),
	}

	raw, _ := json.Marshal(state)
	return raw
}

func (d *AppDelegate) MergeRemoteState(buf []byte, join bool) {
	log.Printf("[SYNC] Received remote state (%d bytes, join= %v)", len(buf), join)

}

func (d *AppDelegate) SetBroadcastQueue(q *memberlist.TransmitLimitedQueue) {
	d.broadcasts = q
}

// broadcast all nodes a custom message
func (d *AppDelegate) BroadcastMsg(msg BroadcastMessage) error {
	raw, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal broadcast: %w", err)

	}

	d.broadcasts.QueueBroadcast(&SimpleBroadcast{msg: raw})
	return nil
}

func main() {
	var (
		nodeName   = flag.String("name", "", "Node name (default: hostname)")
		bindAddr   = flag.String("bind", "0.0.0.0", "Bind address")
		bindPort   = flag.Int("port", 7946, "Bind port")
		joinAddrs  = flag.String("join", "", "Comma-separated list of existing member addresses to join")
		role       = flag.String("role", "worker", "Node role (worker, scheduler, gateway)")
		appVersion = flag.String("version", "1.0.0", "Application version")
	)
	flag.Parse()

	name := *nodeName
	if name == "" {
		hostname, err := os.Hostname()
		if err != nil {
			log.Fatalf("Failed to get hostname: %v", err)

		}
		name = fmt.Sprintf("%s - %d", hostname, *bindPort)
	}

	meta := NodeMeta{
		Role:    *role,
		Version: *appVersion,
		StartAt: time.Now().Unix(),
	}

	eventHandler := NewEventHandler()
	delegate := NewAppDelegate(meta)

	conf := memberlist.DefaultLANConfig()
	conf.Name = name
	conf.BindAddr = *bindAddr
	conf.BindPort = *bindPort
	conf.AdvertisePort = *bindPort
	conf.Events = eventHandler
	conf.Delegate = delegate

	conf.ProbeInterval = 1 * time.Second
	conf.ProbeTimeout = 500 * time.Millisecond
	conf.IndirectChecks = 3 //k =3
	conf.SuspicionMult = 4

	//Gossip
	conf.GossipInterval = 200 * time.Millisecond
	conf.GossipNodes = 3
	conf.GossipToTheDeadTime = 30 * time.Second

	// push/pull broadcast
	conf.PushPullInterval = 30 * time.Second

	// retrans
	conf.RetransmitMult = 4

	conf.Logger = log.New(os.Stderr, fmt.Sprintf("[memberlist: %s]", name), log.LstdFlags)

	list, err := memberlist.Create(conf)
	if err != nil {
		log.Fatalf("Failed to create memberlist: %v", err)

	}

	// set up broadcastqueue
	//
	// set buffer
	broadcastQueue := &memberlist.TransmitLimitedQueue{
		NumNodes: func() int {
			return list.NumMembers()
		},
		RetransmitMult: conf.RetransmitMult,
	}
	delegate.SetBroadcastQueue(broadcastQueue)

	if *joinAddrs != "" {
		parts := strings.Split(*joinAddrs, ",")
		for i := range parts {
			parts[i] = strings.TrimSpace(parts[i])
		}

		numJoined, err := list.Join(parts)
		if err != nil {
			log.Printf("[WARN] Failed to join cluster: %v", err)
		} else {
			log.Printf("[INFO] Successfully joined %d node(s)", numJoined)
		}
	}

	localNode := list.LocalNode()
	log.Printf("[INFO] local node; %s at %s: %d(role = %s)",
		localNode.Name, &localNode.Addr, localNode.Port, *role)

	//set up message solve goroutine
	go func() {
		for msg := range delegate.msgCh {
			log.Printf("[MSG] Receiveed broadcast from = %s type = %s payload = %s",
				msg.From, msg.Type, msg.Payload)
		}
	}()

	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		members := list.Members()
		aliveCount := 0
		for range ticker.C {
			members := list.Members()
			aliveCount := 0
			for _, m := range members {
				if m.State == memberlist.StateAlive {
				}
				aliveCount++ //stateAlive
			}
		}

		log.Printf("[STATUS] Cluster members: %d total, %d alive", len(members), aliveCount)

		for _, m := range members {
			meta := NodeMeta{}
			if len(m.Meta) > 0 {
				_ = json.Unmarshal(m.Meta, &meta)
			}

			stateStr := "alive"
			switch m.State {
			case 1:
				stateStr = "suspect"
			case 2:
				stateStr = "dead"
			case 3:
				stateStr = "left"
			}
			log.Printf(" - %s (%s:%d) state = %s role = %s", m.Name, m.Addr, m.Port, stateStr, meta.Role)

		}
	}()

	go func() {
		time.Sleep(5 * time.Second)
		seq := int64(0)
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			seq++
			msg := BroadcastMessage{
				From:    name,
				Type:    "heartbeat",
				Payload: fmt.Sprintf("node %s is healthy, seq = %d", name, seq),
				Seq:     seq,
			}
			if err := delegate.BroadcastMsg(msg); err != nil {
				log.Printf("[WARN] Failed to braodcast: %v", err)
			}
		}
	}()

	// await left signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh
	log.Printf("[INFO] Received signal %s, leaving cluster...", sig)

	if err := list.Leave(5 * time.Second); err != nil {
		log.Printf("[WARN] Failed to leave cluster gravefully %v", err)
	}

	if err := list.Shutdown(); err != nil {
		log.Printf("[WARN] Failed to shutdown memberlist %v", err)
	}

	log.Printf("[INFO] Node %s has left the cluster", name)
}

func getOutboundIp() net.IP {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return net.IPv4(127, 0, 0, 1)

	}
	defer conn.Close()
	localAddr := conn.LocalAddr().(*net.UDPAddr)
	return localAddr.IP
}
