## [H-03]  "Users could shift tokens on Staker with more than he has staked"

Submitted by shw
The shiftTokens function of Staker checks whether the user has staked at least the number of tokens he wants to shift from one side to the other (line 885). A user could call the shiftTokens function multiple times before the next price update to shift the staker's token from one side to the other with more than he has staked. Staker.sol#L885
Recommend adding checks on userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_long and userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_short to ensure that the sum of the two variables does not exceed user's stake balance.
JasoonS (Float) confirmed:

Yes, spot on! We spotted this the next morning after launching the competition. Token shifting was a last minute addition to the codebase. Really glad someone spotted it, but only in the last few hours, phew!
This would allow a malicious user to completely shift all the tokens (even those not belonging to them to one side or the other!!)
No funds could be stolen by the user directly (since the execution of those shifts would fail on the user level), but it could be done for personal gain (eg improving the users FLT issuance rate, or similar economic manipulation).

Medium Risk Findings (6)


## [H-05]  "Claim airdrop repeatedly"

Submitted by gpersoon, also found by elprofesor, fr0zn, and pauliax
Impact
Suppose someone claims the last part of his airdrop via claimExact() of AirdropDistribution.sol
Then airdrop\[msg.sender].amount will be set to 0.
Suppose you then call validate() again.
The check airdrop\[msg.sender].amount == 0 will allow you to continue, because amount has just be set to 0.
In the next part of the function, airdrop\[msg.sender] is overwritten with fresh values and airdrop\[msg.sender].claimed will be reset to 0.
Now you can claim your airdrop again (as long as there are tokens present in the contract)
Note: The function claim() prevents this from happening via assert(airdrop\[msg.sender].amount - claimable != 0);, which has its own problems, see other reported issues.
Proof of Concept
// https://github.com/code-423n4/2021-11-bootfinance/blob/7c457b2b5ba6b2c887dafdf7428fd577e405d652/vesting/contracts/AirdropDistribution.sol#L555-L563
``solidity
function claimExact(uint256 \_value) external nonReentrant {
require(msg.sender != address(0));
require(airdrop\[msg.sender].amount != 0);
uint256 avail = _available_supply();
uint256 claimable = avail * airdrop[msg.sender].fraction / 10**18; //
if (airdrop[msg.sender].claimed != 0){
    claimable -= airdrop[msg.sender].claimed;
}

require(airdrop[msg.sender].amount >= claimable); // amount can be equal to claimable
require(_value <= claimable);                       // _value can be equal to claimable
airdrop[msg.sender].amount -= _value;      // amount will be set to 0 with the last claim

// <https://github.com/code-423n4/2021-11-bootfinance/blob/7c457b2b5ba6b2c887dafdf7428fd577e405d652/vesting/contracts/AirdropDistribution.sol#L504-L517>solidity
function validate() external nonReentrant {
...
require(airdrop[msg.sender].amount == 0, "Already validated.");
...
Airdrop memory newAirdrop = Airdrop(airdroppable, 0, airdroppable, 10**18 * airdroppable / airdrop_supply);
airdrop[msg.sender] = newAirdrop;
validated[msg.sender] = 1;   // this is set, but isn't checked on entry of this function
```
Recommended Mitigation Steps
Add the following to validate() :
require(validated\[msg.sender]== 0, "Already validated.");
chickenpie347 (Boot Finance) confirmed and resolved:

Addressed in issue #101 



## [H-06]  "Rewards can be claimed multiple times"

Submitted by johnnycash, also found by certora, cmichel, gpersoon, gzeon, harleythedog, kemmio, kenzo, sirhashalot, and 0x421f
Impact
An attacker can claim its reward 256 * epochDuration seconds after the timestamp at which the promotion started. The vulnerability allows him to claim a reward several times to retrieve all the tokens associated to the promotion.
Analysis
claimRewards() claim rewards for a given promotion and epoch. In order to prevent a user from claiming a reward multiple times, the mapping _claimedEpochs keeps track of claimed rewards per user:
solidity
/// @notice Keeps track of claimed rewards per user.
/// @dev _claimedEpochs[promotionId][user] => claimedEpochs
/// @dev We pack epochs claimed by a user into a uint256. So we can't store more than 255 epochs.
mapping(uint256 => mapping(address => uint256)) internal _claimedEpochs;
(The comment is wrong, epochs are packed into a uint256 which allows 256 epochs to be stored).
_epochIds is an array of uint256. For each _epochId in this array, claimRewards() checks that the reward associated to this _epochId isn't already claimed thanks to
_isClaimedEpoch(). _isClaimedEpoch() checks that the bit _epochId of _claimedEpochs is unset:
solidity
(_userClaimedEpochs >> _epochId) & uint256(1) == 1;
However, if _epochId is greater than 255, _isClaimedEpoch() always returns false. It allows an attacker to claim a reward several times.
_calculateRewardAmount() just makes use of _epochId to tell whether the promotion is over.
Proof of Concept
The following test should result in a reverted transaction, however the transaction succeeds.
```js
it('should fail to claim rewards if one or more epochs have already been claimed', async () => {
    const promotionId = 1;
const wallet2Amount = toWei('750');
const wallet3Amount = toWei('250');

await ticket.mint(wallet2.address, wallet2Amount);
await ticket.mint(wallet3.address, wallet3Amount);

await createPromotion(ticket.address);
await increaseTime(epochDuration * 257);

await expect(
    twabRewards.claimRewards(wallet2.address, promotionId, ['256', '256']),
).to.be.revertedWith('TwabRewards/rewards-already-claimed');

});
```
Recommended Mitigation Steps
A possible fix could be to change the type of _epochId to uint8 in:

_calculateRewardAmount()
_updateClaimedEpoch()
_isClaimedEpoch()

and change the type of _epochIds to uint8[] in claimRewards().
PierrickGT (PoolTogether) confirmed


## [H-07]  "Shelter claimed mapping is set with _to address and not msg.sender"

Submitted by 0xliumin, also found by cmichel, leastwood, and pauliax
Any user can withdraw all the funds from the shelter. This is done by calling withdraw repeatedly until all funds are drained. You only need to have a small share.
Even if the claimed mapping was checked, there would still be a vulnerability. This is because the claimed mapping is updated with the _to address, not the msg.sender address.
Recommended Mitigation Steps
Remediation is to change the _to to msg.sender.
Shelter.sol#L55
leekt (Concur) confirmed
Alex the Entreprenerd (judge) increased severity to High and commented:

Am marking this as a unique finding as this one shows another issue with the Shelter withdraw function.
Because this also allows for draining of all rewards, am raising to High Severity.




