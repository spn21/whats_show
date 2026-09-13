// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ZkAssetRaffle
 * @dev A verifiable raffle protocol for real-world assets using zero-knowledge proofs
 */
contract ZkAssetRaffle is Ownable {
    
    constructor() Ownable(msg.sender) {}
    
    // Raffle states
    enum RaffleState { Created, Committed, Revealed, Closed }
    
    struct AssetRaffle {
        string raffleId;           // Backend activity_id
        bytes32 merkleRoot;        // Merkle root of all tickets
        string encryptionKey;      // Encryption key (revealed after commit phase)
        RaffleState state;         // Current raffle state
        address creator;           // Raffle creator
        uint256 totalTickets;      // Total number of tickets
        uint256 createdAt;         // Creation timestamp
        bool keyRevealed;          // Whether key has been revealed
    }
    
    struct TicketClaim {
        address claimer;           // Who claimed this ticket
        bytes encryptedData;       // Encrypted winning information
        bool isRedeemed;           // Whether prize has been redeemed
        uint256 claimedAt;         // When ticket was claimed
    }
    
    // Storage
    mapping(string => AssetRaffle) public raffles;
    mapping(string => mapping(bytes32 => TicketClaim)) public ticketClaims; // raffleId => ticketId => claim
    mapping(string => bool) public raffleExists;
    
    // Events
    event RaffleCreated(
        string indexed raffleId,
        address indexed creator,
        uint256 totalTickets,
        uint256 timestamp
    );
    
    event RaffleCommitted(
        string indexed raffleId,
        bytes32 merkleRoot,
        uint256 timestamp
    );
    
    event TicketClaimed(
        string indexed raffleId,
        bytes32 indexed ticketId,
        address indexed claimer,
        uint256 timestamp
    );
    
    event RaffleKeyRevealed(
        string indexed raffleId,
        string encryptionKey,
        uint256 timestamp
    );
    
    event PrizeRedeemed(
        string indexed raffleId,
        bytes32 indexed ticketId,
        address indexed winner,
        uint8 prizeLevel,
        uint256 timestamp
    );
    
    // Modifiers
    modifier raffleExistsMod(string calldata raffleId) {
        require(raffleExists[raffleId], "ZkAssetRaffle: Raffle does not exist");
        _;
    }
    
    modifier onlyRaffleCreator(string calldata raffleId) {
        require(raffles[raffleId].creator == msg.sender, "ZkAssetRaffle: Not raffle creator");
        _;
    }
    
    modifier inState(string calldata raffleId, RaffleState expectedState) {
        require(raffles[raffleId].state == expectedState, "ZkAssetRaffle: Invalid raffle state");
        _;
    }

    modifier canClaim(string calldata raffleId) {
        RaffleState currentState = raffles[raffleId].state;
        require(
            currentState == RaffleState.Committed || currentState == RaffleState.Revealed,
            "ZkAssetRaffle: Cannot claim in current state"
        );
        _;
    }
    
    /**
     * @dev Create a new asset raffle
     * @param raffleId Unique identifier for the raffle (from backend)
     * @param totalTickets Total number of tickets in this raffle
     */
    function createRaffle(
        string calldata raffleId,
        uint256 totalTickets
    ) external {
        require(!raffleExists[raffleId], "ZkAssetRaffle: Raffle already exists");
        require(totalTickets > 0, "ZkAssetRaffle: Invalid ticket count");
        
        raffles[raffleId] = AssetRaffle({
            raffleId: raffleId,
            merkleRoot: bytes32(0),
            encryptionKey: "",
            state: RaffleState.Created,
            creator: msg.sender,
            totalTickets: totalTickets,
            createdAt: block.timestamp,
            keyRevealed: false
        });
        
        raffleExists[raffleId] = true;
        
        emit RaffleCreated(raffleId, msg.sender, totalTickets, block.timestamp);
    }
    
    /**
     * @dev Commit the merkle root to blockchain (make it immutable)
     * @param raffleId The raffle identifier
     * @param merkleRoot The merkle root of all tickets
     */
    function commitRaffle(
        string calldata raffleId,
        bytes32 merkleRoot
    ) external 
        raffleExistsMod(raffleId)
        onlyRaffleCreator(raffleId)
        inState(raffleId, RaffleState.Created)
    {
        require(merkleRoot != bytes32(0), "ZkAssetRaffle: Invalid merkle root");
        
        raffles[raffleId].merkleRoot = merkleRoot;
        raffles[raffleId].state = RaffleState.Committed;
        
        emit RaffleCommitted(raffleId, merkleRoot, block.timestamp);
    }
    
    /**
     * @dev Claim a ticket by scanning QR code
     * @param raffleId The raffle identifier
     * @param ticketId The ticket identifier (SID from QR code)
     * @param encryptedData The encrypted winning information
     */
    function claimTicket(
        string calldata raffleId,
        bytes32 ticketId,
        bytes calldata encryptedData
    ) external 
        raffleExistsMod(raffleId)
        canClaim(raffleId)
    {
        require(ticketClaims[raffleId][ticketId].claimer == address(0), "ZkAssetRaffle: Ticket already claimed");
        
        ticketClaims[raffleId][ticketId] = TicketClaim({
            claimer: msg.sender,
            encryptedData: encryptedData,
            isRedeemed: false,
            claimedAt: block.timestamp
        });
        
        emit TicketClaimed(raffleId, ticketId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Reveal the encryption key (only by raffle creator)
     * @param raffleId The raffle identifier
     * @param encryptionKey The key to decrypt winning information
     */
    function revealKey(
        string calldata raffleId,
        string calldata encryptionKey
    ) external 
        raffleExistsMod(raffleId)
        onlyRaffleCreator(raffleId)
        inState(raffleId, RaffleState.Committed)
    {
        require(bytes(encryptionKey).length > 0, "ZkAssetRaffle: Invalid encryption key");
        
        raffles[raffleId].encryptionKey = encryptionKey;
        raffles[raffleId].keyRevealed = true;
        raffles[raffleId].state = RaffleState.Revealed;
        
        emit RaffleKeyRevealed(raffleId, encryptionKey, block.timestamp);
    }
    
    /**
     * @dev Redeem prize using decrypted information and merkle proof
     * @param raffleId The raffle identifier
     * @param ticketId The ticket identifier
     * @param secretValue The secret value (r_i from decryption)
     * @param prizeLevel The prize level (win_i from decryption)
     * @param merkleProof The merkle proof for verification
     */
    function redeemPrize(
        string calldata raffleId,
        bytes32 ticketId,
        string calldata secretValue,
        uint8 prizeLevel,
        bytes32[] calldata merkleProof
    ) external 
        raffleExistsMod(raffleId)
        inState(raffleId, RaffleState.Revealed)
    {
        TicketClaim storage claim = ticketClaims[raffleId][ticketId];
        require(claim.claimer == msg.sender, "ZkAssetRaffle: Not ticket owner");
        require(!claim.isRedeemed, "ZkAssetRaffle: Prize already redeemed");
        
        // Verify merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(
            _bytes32ToString(ticketId), 
            secretValue, 
            Strings.toString(prizeLevel)
        ));
        
        // Get merkle root to avoid stack too deep error
        bytes32 rootHash = raffles[raffleId].merkleRoot;
        require(
            MerkleProof.verify(merkleProof, rootHash, leaf),
            "ZkAssetRaffle: Invalid merkle proof"
        );
        
        claim.isRedeemed = true;
        
        emit PrizeRedeemed(raffleId, ticketId, msg.sender, prizeLevel, block.timestamp);
    }
    
    /**
     * @dev Close a raffle (only by creator, for cleanup)
     * @param raffleId The raffle identifier
     */
    function closeRaffle(
        string calldata raffleId
    ) external 
        raffleExistsMod(raffleId)
        onlyRaffleCreator(raffleId)
    {
        require(raffles[raffleId].state == RaffleState.Revealed, "ZkAssetRaffle: Cannot close raffle");
        
        raffles[raffleId].state = RaffleState.Closed;
    }
    
    // View functions
    
    /**
     * @dev Get raffle information
     * @param raffleId The raffle identifier
     */
    function getRaffle(string calldata raffleId) external view returns (AssetRaffle memory) {
        require(raffleExists[raffleId], "ZkAssetRaffle: Raffle does not exist");
        return raffles[raffleId];
    }
    
    /**
     * @dev Get ticket claim information
     * @param raffleId The raffle identifier
     * @param ticketId The ticket identifier
     */
    function getTicketClaim(
        string calldata raffleId, 
        bytes32 ticketId
    ) external view returns (TicketClaim memory) {
        return ticketClaims[raffleId][ticketId];
    }
    
    /**
     * @dev Check if a ticket has been claimed
     * @param raffleId The raffle identifier
     * @param ticketId The ticket identifier
     */
    function isTicketClaimed(
        string calldata raffleId, 
        bytes32 ticketId
    ) external view returns (bool) {
        return ticketClaims[raffleId][ticketId].claimer != address(0);
    }
    
    /**
     * @dev Get the revealed encryption key
     * @param raffleId The raffle identifier
     */
    function getEncryptionKey(string calldata raffleId) external view returns (string memory) {
        require(raffles[raffleId].keyRevealed, "ZkAssetRaffle: Key not revealed yet");
        return raffles[raffleId].encryptionKey;
    }
    
    // Internal helper functions
    
    /**
     * @dev Convert bytes32 to string (for SID conversion in merkle proof)
     */
    function _bytes32ToString(bytes32 _bytes32) internal pure returns (string memory) {
        uint8 i = 0;
        while(i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (uint8 j = 0; j < i; j++) {
            bytesArray[j] = _bytes32[j];
        }
        return string(bytesArray);
    }
}