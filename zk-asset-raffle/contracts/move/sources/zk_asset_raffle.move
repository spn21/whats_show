module zk_asset_raffle::raffle {
    use std::option::{Self as option, Option};
    use std::vector;
    use sui::address;
    use sui::clock::Clock;
    use sui::clock;
    use sui::event;
    use sui::hash;
    use sui::object::{Self as object, UID};
    use sui::table::{Self as table, Table};
    use sui::transfer;
    use sui::tx_context;
    use sui::tx_context::TxContext;

    const STATE_CREATED: u8 = 0;
    const STATE_COMMITTED: u8 = 1;
    const STATE_REVEALED: u8 = 2;
    const STATE_CLOSED: u8 = 3;

    const E_RAFFLE_EXISTS: u64 = 0;
    const E_RAFFLE_NOT_FOUND: u64 = 1;
    const E_NOT_CREATOR: u64 = 2;
    const E_INVALID_STATE: u64 = 3;
    const E_TICKET_ALREADY_CLAIMED: u64 = 4;
    const E_TICKET_NOT_FOUND: u64 = 5;
    const E_NOT_TICKET_OWNER: u64 = 6;
    const E_ALREADY_REDEEMED: u64 = 7;
    const E_MERKLE_ROOT_MISSING: u64 = 8;
    const E_INVALID_MERKLE_PROOF: u64 = 9;
    const E_ENCRYPTION_KEY_EMPTY: u64 = 10;
    const E_KEY_NOT_REVEALED: u64 = 11;

    struct RaffleRegistry has key {
        id: UID,
        raffles: Table<address, RaffleData>,
    }

    struct RaffleData has store {
        raffle_id: vector<u8>,
        merkle_root: Option<vector<u8>>,
        encryption_key: Option<vector<u8>>,
        state: u8,
        creator: address,
        total_tickets: u64,
        created_at: u64,
        key_revealed: bool,
        ticket_claims: Table<address, TicketClaim>,
    }

    struct TicketClaim has store {
        ticket_id: vector<u8>,
        claimer: address,
        encrypted_data: vector<u8>,
        is_redeemed: bool,
        claimed_at: u64,
    }

    struct RaffleCreated has copy, drop, store {
        raffle_id: vector<u8>,
        creator: address,
        total_tickets: u64,
        timestamp_ms: u64,
    }

    struct RaffleCommitted has copy, drop, store {
        raffle_id: vector<u8>,
        merkle_root: vector<u8>,
        timestamp_ms: u64,
    }

    struct TicketClaimed has copy, drop, store {
        raffle_id: vector<u8>,
        ticket_id: vector<u8>,
        claimer: address,
        timestamp_ms: u64,
    }

    struct RaffleKeyRevealed has copy, drop, store {
        raffle_id: vector<u8>,
        encryption_key: vector<u8>,
        timestamp_ms: u64,
    }

    struct PrizeRedeemed has copy, drop, store {
        raffle_id: vector<u8>,
        ticket_id: vector<u8>,
        winner: address,
        prize_level: u8,
        timestamp_ms: u64,
    }

    struct RaffleClosed has copy, drop, store {
        raffle_id: vector<u8>,
        timestamp_ms: u64,
    }

    fun raffle_key(bytes: &vector<u8>): address {
        hash_to_address(bytes)
    }

    fun ticket_key(bytes: &vector<u8>): address {
        hash_to_address(bytes)
    }

    fun hash_to_address(data: &vector<u8>): address {
        let digest = hash::keccak256(data);
        address::from_bytes(copy_bytes(&digest))
    }

    fun ensure_raffle_exists(registry: &RaffleRegistry, key: address) {
        assert!(table::contains(&registry.raffles, key), E_RAFFLE_NOT_FOUND);
    }

    fun init(ctx: &mut TxContext) {
        let registry = RaffleRegistry {
            id: object::new(ctx),
            raffles: table::new(ctx),
        };
        transfer::share_object(registry);
    }

    public entry fun create_raffle(
        registry: &mut RaffleRegistry,
        raffle_id: vector<u8>,
        total_tickets: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let key = raffle_key(&raffle_id);
        assert!(!table::contains(&registry.raffles, key), E_RAFFLE_EXISTS);
        assert!(total_tickets > 0, E_INVALID_STATE);

        let now = clock::timestamp_ms(clock);
        let creator_addr = tx_context::sender(ctx);
        let data = RaffleData {
            raffle_id: copy_bytes(&raffle_id),
            merkle_root: option::none(),
            encryption_key: option::none(),
            state: STATE_CREATED,
            creator: creator_addr,
            total_tickets,
            created_at: now,
            key_revealed: false,
            ticket_claims: table::new(ctx),
        };

        table::add(&mut registry.raffles, key, data);
        event::emit(RaffleCreated {
            raffle_id,
            creator: creator_addr,
            total_tickets,
            timestamp_ms: now,
        });
    }

    public entry fun commit_raffle(
        registry: &mut RaffleRegistry,
        raffle_id: vector<u8>,
        merkle_root: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let key = raffle_key(&raffle_id);
        ensure_raffle_exists(registry, key);
        let raffle = table::borrow_mut(&mut registry.raffles, key);

        assert!(raffle.creator == tx_context::sender(ctx), E_NOT_CREATOR);
        assert!(raffle.state == STATE_CREATED, E_INVALID_STATE);
        assert!(option::is_none(&raffle.merkle_root), E_INVALID_STATE);

        let root_copy = copy_bytes(&merkle_root);
        raffle.merkle_root = option::some(merkle_root);
        raffle.state = STATE_COMMITTED;

        event::emit(RaffleCommitted {
            raffle_id,
            merkle_root: root_copy,
            timestamp_ms: clock::timestamp_ms(clock),
        });
    }

    public entry fun claim_ticket(
        registry: &mut RaffleRegistry,
        raffle_id: vector<u8>,
        ticket_id: vector<u8>,
        encrypted_data: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let key = raffle_key(&raffle_id);
        ensure_raffle_exists(registry, key);
        let raffle = table::borrow_mut(&mut registry.raffles, key);

        assert!(
            raffle.state == STATE_COMMITTED || raffle.state == STATE_REVEALED,
            E_INVALID_STATE
        );
        let ticket_lookup = ticket_key(&ticket_id);
        assert!(
            !table::contains(&raffle.ticket_claims, ticket_lookup),
            E_TICKET_ALREADY_CLAIMED
        );

        let now = clock::timestamp_ms(clock);
        let sender = tx_context::sender(ctx);
        let claim = TicketClaim {
            ticket_id: copy_bytes(&ticket_id),
            claimer: sender,
            encrypted_data,
            is_redeemed: false,
            claimed_at: now,
        };
        table::add(&mut raffle.ticket_claims, ticket_lookup, claim);

        event::emit(TicketClaimed {
            raffle_id,
            ticket_id,
            claimer: sender,
            timestamp_ms: now,
        });
    }

    public entry fun reveal_encryption_key(
        registry: &mut RaffleRegistry,
        raffle_id: vector<u8>,
        encryption_key: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let key = raffle_key(&raffle_id);
        ensure_raffle_exists(registry, key);
        let raffle = table::borrow_mut(&mut registry.raffles, key);

        assert!(raffle.creator == tx_context::sender(ctx), E_NOT_CREATOR);
        assert!(raffle.state == STATE_COMMITTED, E_INVALID_STATE);
        assert!(!raffle.key_revealed, E_INVALID_STATE);
        assert!(vector::length(&encryption_key) > 0, E_ENCRYPTION_KEY_EMPTY);

        let key_copy = copy_bytes(&encryption_key);
        raffle.encryption_key = option::some(encryption_key);
        raffle.key_revealed = true;
        raffle.state = STATE_REVEALED;

        event::emit(RaffleKeyRevealed {
            raffle_id,
            encryption_key: key_copy,
            timestamp_ms: clock::timestamp_ms(clock),
        });
    }

    public entry fun redeem_prize(
        registry: &mut RaffleRegistry,
        raffle_id: vector<u8>,
        ticket_id: vector<u8>,
        secret_value: vector<u8>,
        prize_level: u8,
        merkle_proof: vector<vector<u8>>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let key = raffle_key(&raffle_id);
        ensure_raffle_exists(registry, key);
        let raffle = table::borrow_mut(&mut registry.raffles, key);

        let sender = tx_context::sender(ctx);
        assert!(raffle.state == STATE_REVEALED, E_INVALID_STATE);
        assert!(raffle.key_revealed, E_KEY_NOT_REVEALED);
        assert!(option::is_some(&raffle.merkle_root), E_MERKLE_ROOT_MISSING);

        let ticket_lookup = ticket_key(&ticket_id);
        assert!(
            table::contains(&raffle.ticket_claims, &ticket_lookup),
            E_TICKET_NOT_FOUND
        );

        let claim = table::borrow_mut(&mut raffle.ticket_claims, ticket_lookup);
        assert!(claim.claimer == sender, E_NOT_TICKET_OWNER);
        assert!(!claim.is_redeemed, E_ALREADY_REDEEMED);

        let prize_bytes = u8_to_ascii(prize_level);
        let leaf = compute_leaf(&ticket_id, &secret_value, &prize_bytes);
        let root_ref = option::borrow(&raffle.merkle_root);

        assert!(verify_merkle_proof(&merkle_proof, root_ref, &leaf), E_INVALID_MERKLE_PROOF);

        claim.is_redeemed = true;
        let timestamp = clock::timestamp_ms(clock);

        event::emit(PrizeRedeemed {
            raffle_id,
            ticket_id,
            winner: sender,
            prize_level,
            timestamp_ms: timestamp,
        });
    }

    public entry fun close_raffle(
        registry: &mut RaffleRegistry,
        raffle_id: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let key = raffle_key(&raffle_id);
        ensure_raffle_exists(registry, key);
        let raffle = table::borrow_mut(&mut registry.raffles, key);

        assert!(raffle.creator == tx_context::sender(ctx), E_NOT_CREATOR);
        assert!(raffle.state == STATE_REVEALED, E_INVALID_STATE);

        raffle.state = STATE_CLOSED;

        event::emit(RaffleClosed {
            raffle_id,
            timestamp_ms: clock::timestamp_ms(clock),
        });
    }

    public fun get_raffle<'a>(
        registry: &'a RaffleRegistry,
        raffle_id: &vector<u8>
    ): &'a RaffleData {
        let key = raffle_key(raffle_id);
        ensure_raffle_exists(registry, key);
        table::borrow(&registry.raffles, key)
    }

    public fun get_ticket_claim<'a>(
        registry: &'a RaffleRegistry,
        raffle_id: &vector<u8>,
        ticket_id: &vector<u8>
    ): &'a TicketClaim {
        let key = raffle_key(raffle_id);
        ensure_raffle_exists(registry, key);
        let raffle = table::borrow(&registry.raffles, key);
        let ticket_lookup = ticket_key(ticket_id);
        assert!(table::contains(&raffle.ticket_claims, ticket_lookup), E_TICKET_NOT_FOUND);
        table::borrow(&raffle.ticket_claims, ticket_lookup)
    }

    public fun is_ticket_claimed(
        registry: &RaffleRegistry,
        raffle_id: &vector<u8>,
        ticket_id: &vector<u8>
    ): bool {
        let key = raffle_key(raffle_id);
        if (!table::contains(&registry.raffles, key)) {
            return false
        };
        let raffle = table::borrow(&registry.raffles, key);
        let ticket_lookup = ticket_key(ticket_id);
        table::contains(&raffle.ticket_claims, ticket_lookup)
    }

    public fun get_encryption_key<'a>(
        registry: &'a RaffleRegistry,
        raffle_id: &vector<u8>
    ): &'a vector<u8> {
        let key = raffle_key(raffle_id);
        ensure_raffle_exists(registry, key);
        let raffle = table::borrow(&registry.raffles, key);
        assert!(raffle.key_revealed, E_KEY_NOT_REVEALED);
        option::borrow(&raffle.encryption_key)
    }

    fun compute_leaf(
        ticket_id: &vector<u8>,
        secret_bytes: &vector<u8>,
        prize_bytes: &vector<u8>
    ): vector<u8> {
        let mut data = vector::empty<u8>();
        append_bytes(&mut data, ticket_id);
        append_bytes(&mut data, secret_bytes);
        append_bytes(&mut data, prize_bytes);
        hash::keccak256(&data)
    }

    fun verify_merkle_proof(
        proof: &vector<vector<u8>>,
        root: &vector<u8>,
        leaf: &vector<u8>
    ): bool {
        let mut computed = copy_bytes(leaf);
        let len = vector::length(proof);
        let mut i = 0;
        while (i < len) {
            let sibling = vector::borrow(proof, i);
            computed = hash_pair(&computed, sibling);
            i = i + 1;
        };
        bytes_equal(&computed, root)
    }

    fun hash_pair(first: &vector<u8>, second: &vector<u8>): vector<u8> {
        let mut data = vector::empty<u8>();
        if (bytes_less_equal(first, second)) {
            append_bytes(&mut data, first);
            append_bytes(&mut data, second);
        } else {
            append_bytes(&mut data, second);
            append_bytes(&mut data, first);
        };
        hash::keccak256(&data)
    }

    fun bytes_less_equal(a: &vector<u8>, b: &vector<u8>): bool {
        let len_a = vector::length(a);
        let len_b = vector::length(b);
        let mut i = 0;
        while (i < len_a && i < len_b) {
            let byte_a = *vector::borrow(a, i);
            let byte_b = *vector::borrow(b, i);
            if (byte_a < byte_b) {
                return true
            };
            if (byte_a > byte_b) {
                return false
            };
            i = i + 1;
        };
        len_a <= len_b
    }

    fun bytes_equal(a: &vector<u8>, b: &vector<u8>): bool {
        let len_a = vector::length(a);
        let len_b = vector::length(b);
        if (len_a != len_b) {
            return false
        };
        let mut i = 0;
        while (i < len_a) {
            if (*vector::borrow(a, i) != *vector::borrow(b, i)) {
                return false
            };
            i = i + 1;
        };
        true
    }

    fun u8_to_ascii(value: u8): vector<u8> {
        let mut digits = vector::empty<u8>();
        if (value == 0) {
            vector::push_back(&mut digits, 48);
            return digits
        };

        let mut temp = value;
        while (temp > 0) {
            let digit = (temp % 10) + 48;
            vector::push_back(&mut digits, digit);
            temp = temp / 10;
        };
        vector::reverse(&mut digits);
        digits
    }

    fun copy_bytes(data: &vector<u8>): vector<u8> {
        let mut out = vector::empty<u8>();
        append_bytes(&mut out, data);
        out
    }

    fun append_bytes(target: &mut vector<u8>, source: &vector<u8>) {
        let len = vector::length(source);
        let mut i = 0;
        while (i < len) {
            let byte = *vector::borrow(source, i);
            vector::push_back(target, byte);
            i = i + 1;
        };
    }
}
