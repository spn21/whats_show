## [H-02]  "Missing fromToken != toToken check"

Attacker calls MarginRouter.crossSwapExactTokensForTokens with a fake pair and the same token[0] == token[1].
crossSwapExactTokensForTokens(1000 WETH, 0, [ATTACKER_CONTRACT], [WETH, WETH]). When the amounts are computed by the amounts = UniswapStyleLib.getAmountsOut(amountIn - fees, pairs, tokens); call, the attacker contract returns fake reserves that yield 0 output. When _swapExactT4T is called, the funds are sent to the fake contract and doing nothing passes all checks in _swap call that follows because the startingBalance is stored after the initial Fund withdraw to the pair.
```solidity
function _swapExactT4T() {
  // withdraw happens here
    Fund(fund()).withdraw(tokens[0], pairs[0], amounts[0]);
    _swap(amounts, pairs, tokens, fund());
}
function _swap() {
  uint256 startingBalance = IERC20(outToken).balanceOf(_to);
  uint256 endingBalance = IERC20(outToken).balanceOf(_to);
  // passes as startingBalance == endingBalance + 0
  require(
      endingBalance >= startingBalance + amounts[amounts.length - 1],
      "Defective AMM route; balances don't match"
  );
}
```
The full impact is not yet known as registerTrade could still fail when subtracting the inAmount and adding 0 outAmount.
At least, this attack is similar to a withdrawal which is supposed to only occur after a certain coolingOffPeriod has passed, but this time-lock is circumvented with this attack.
Recommend moving the fund withdrawal to the first pair after the startingBalance assignment. Check fromToken != toToken as cyclical trades (arbitrages) are likely not what margin traders are after. Consider if the same check is required for registerTradeAndBorrow / adjustAmounts functions.


## [H-04]  "Proposals can be cancelled"

Anyone can cancel any proposals by calling DAO.cancelProposal(id, id) with oldProposalID == newProposalID.
This always passes the minority check as the proposal was approved.
An attacker can launch a denial of service attack on the DAO governance and prevent any proposals from being executed.
Recommend checking that oldProposalID == newProposalID
strictly-scarce (vader) confirmed:

This is valid, can fix with a require()

strictly-scarce (vader) commented:


## [H-01]  "Duplication of Balance"

It is possible to duplicate currently held ink or art within a Cauldron, thereby breaking the contract's accounting system and minting units out of thin air.
The stir function of the Cauldron, which can be invoked via a Ladle operation, caches balances in memory before decrementing and incrementing. As a result, if a transfer to self is performed, the assignment balances[to] = balancesTo will contain the added-to balance instead of the neutral balance.
This allows one to duplicate any number of ink or art units at will, thereby severely affecting the protocol's integrity. A similar attack was exploited in the third bZx hack resulting in a roughly 8 million loss.
Recommend that a require check should be imposed prohibiting the from and to variables to be equivalent.
albertocuestacanada (Yield) confirmed:

It is a good finding and a scary one. It will be fixed. Duplicated with #7.



## [H-02]  "Can access cards of other markets"

Submitted by gpersoon
Within RCMarket.sol the functions ownerOf and onlyTokenOwner do not check if the _cardId/_token is smaller than numberOfCards. So it's possible to supply a larger number and access cards of other markets.
The most problematic seems to be upgradeCard. Here the check for isMarketApproved can be circumvented by trying to move the card via another market.
You can still only move cards you own.
```solidity
// https://github.com/code-423n4/2021-06-realitycards/blob/main/contracts/RCMarket.sol#L338
    function ownerOf(uint256 _cardId) public view override returns (address) {
        uint256 _tokenId = _cardId + totalNftMintCount; // doesn't check if _cardId < numberOfCards
        return nfthub.ownerOf(_tokenId);
    }
https://github.com/code-423n4/2021-06-realitycards/blob/main/contracts/RCMarket.sol#L313
  modifier onlyTokenOwner(uint256 token) {
        require(msgSender() == ownerOf(_token), "Not owner"); // _token could be higher than numberOfCards,
        ;
    }
function upgradeCard(uint256 _card) external onlyTokenOwner(_card) {   // _card  could be higher than numberOfCards,
    _checkState(States.WITHDRAW);
    require(
        !factory.trapIfUnapproved() ||
            factory.isMarketApproved(address(this)),   // this can be circumvented by calling the function via another market
        "Upgrade blocked"
    );
    uint256 _tokenId = _card + totalNftMintCount;    // _card  could be higher than numberOfCards, thus accessing a card in another market
    _transferCard(ownerOf(_card), address(this), _card); // contract becomes final resting place
    nfthub.withdrawWithMetadata(_tokenId);
    emit LogNftUpgraded(_card, _tokenId);
}
```
Recommend adding the following to ownerOf:
require(_card < numberOfCards, "Card does not exist");
Splidge (Reality Cards) confirmed but recommended higher severity:

I would assign this a higher severity level, I think it should be 3(High Risk) as this can be used to steal assets. An NFT being an asset as defined in the warden judging criteria found here.
It is planned that eventually market creation will be opened up to anyone. There are several steps along this path towards opening up market creation:
1. only the Factory owner can create markets
2. Governors will be assigned who also have the ability to create markets
3. Anybody can be allowed to create markets by calling changeMarketCreationGovernorsOnly
4. NFTs allowed to be created (or more accurately not burned on market completion) by anyone by calling changeTrapCardsIfUnapproved
The key here is that even in step 3 where anybody can create a market, the market will still require Governor approval for it to be displayed in the UI and for the NFT to be allowed to be upgraded. It is here in step 3 that upgradeCard could be called on an approved market in order to move a card from an unapproved market.

mcplums (Reality Cards) confirmed:

Agreed, this indeed should have a higher severity- fantastic catch @gpersoon!!

Splidge (Reality Cards) resolved:

Fixed here
Impressed also with the simplicity of the solution.

dmvt (Judge) commented:

Agree with the higher severity



## [H-05]  "Insurance slippage reimbursement can be used to steal insurance fund"

Submitted by cmichel
The Liquidation contract allows the liquidator to submit "bad" trade orders and the insurance reimburses them from the insurance fund, see Liquidation.claimReceipt.
The function can be called with an orders array, which does not check for duplicate orders.
An attacker can abuse this to make a profit by liquidating themselves, making a small bad trade and repeatedly submitting this bad trade for slippage reimbursement.
Example:
- Attacker uses two accounts, one as the liquidator and one as the liquidatee.
- They run some high-leverage trades such that the liquidatee gets liquidated with the next price update. (If not cash out and make a profit this way through trading, and try again.)
- Liquidator liquidates liquidatee
- They now do two trades:
  - One "good" trade at the market price that fills 99% of the liquidation amount. The slippage protection should not kick in for this trade
  - One "bad" trade at a horrible market price that fills only 1% of the liquidation amount. This way the slippage protection kicks in for this trade
- The liquidator now calls claimReceipt(orders) where orders is an array that contains many duplicates of the "bad" trade, for example 100 times. The calcUnitsSold function will return unitsSold = receipt.amountLiquidated and a bad avgPrice. They are now reimbursed the price difference on the full liquidation amount (instead of only on 1% of it) making an overall profit
This can be repeated until the insurance fund is drained.
The attacker has an incentive to do this attack as it's profitable and the insurance fund will be completely drained.
Recommend disallowing duplicate orders in the orders argument of claimReceipt. This should make the attack at least unprofitable, but it could still be a griefing attack.
A quick way to ensure that orders does not contain duplicates is by having liquidators submit the orders in a sorted way (by order ID) and then checking in the calcUnitsSold for loop that the current order ID is strictly greater than the previous one.
BenjaminPatch (Tracer) confirmed:

Valid issue. The recommended mitigation step would also work. :+1:



## [H-01]  "Self transfer can lead to unlimited mint"

Submitted by Omik, also found by gpersoon
The implementation of the transfer function in nTokenAction.sol is different from the usual erc20 token transfer function.
This happens because it counts the incentive that the user gets, but with a self-transfer,  it can lead to unlimited mint. In L278, it makes the amount negative, but in L279, it returns the value to an amount that is not negative. So, in the L281-282, it finalizes a positive value, only because the negative value is changed to the positive value.
You can interact with this transfer function through nTokenERC20Proxy.sol.
Recommend adding (sender != recipient).


## [H-04]  "SwappableYieldSource: Missing same deposit token check in transferFunds()"

Submitted by hickuphh3, also found by 0xRajeev
transferFunds() will transfer funds from a specified yield source _yieldSource to the current yield source set in the contract _currentYieldSource. However, it fails to check that the deposit tokens are the same. If the specified yield source's assets are of a higher valuation, then a malicious owner or asset manager will be able to exploit and pocket the difference.
Assumptions:
- _yieldSource has a deposit token of WETH (18 decimals)
- _currentYieldSource has a deposit token of DAI (18 decimals)
- 1 WETH > 1 DAI (definitely true, I'd be really sad otherwise)
Attacker does the following:
1. Deposit 100 DAI into the swappable yield source contract
2. Call transferFunds(_yieldSource, 100 * 1e18)
    - _requireDifferentYieldSource() passes
    - _transferFunds(_yieldSource, 100 * 1e18) is called
        - _yieldSource.redeemToken(_amount); → This will transfer 100 WETH out of the _yieldSource into the contract
        - uint256 currentBalance = IERC20Upgradeable(_yieldSource.depositToken()).balanceOf(address(this)); → This will equate to ≥ 100 WETH.
        - require(_amount <= currentBalance, "SwappableYieldSource/transfer-amount-different"); is true since both are 100 * 1e18
        - _currentYieldSource.supplyTokenTo(currentBalance, address(this)); → This supplies the transferred 100 DAI from step 1 to the current yield source
    - We now have 100 WETH in the swappable yield source contract
3. Call transferERC20(WETH, attackerAddress, 100 * 1e18) to withdraw 100 WETH out of the contract to the attacker's desired address.
_requireDifferentYieldSource() should also verify that the yield sources' deposit token addresses are the same.
jsx
function _requireDifferentYieldSource(IYieldSource _yieldSource) internal view {
    require(address(_yieldSource) != address(yieldSource), "SwappableYieldSource/same-yield-source");
        require(_newYieldSource.depositToken() == yieldSource.depositToken(), "SwappableYieldSource/different-deposit-token");
}
PierrickGT (PoolTogether) acknowledged:

This exploit was indeed possible when we had the transferFunds function but now that we have removed it and funds can only be moved by swapYieldSource(), this exploit is no longer possible since we check for the same depositToken in _setYieldSource().
https://github.com/pooltogether/swappable-yield-source/pull/4

0xean (Judge) commented:

Upgrading to 3 considering the potential for loss of funds

Medium Risk Findings (4)


## [H-03]  "transferNotionalFrom doesn’t check from != to"

Submitted by gpersoon, also found by cmichel.
Impact
The function transferNotionalFrom of VaultTracker.sol uses temporary variables to store the balances.
If the "from" and "to" address are the same then the balance of "from" is overwritten by the balance of "to".
This means the balance of "from" and "to" are increased and no balances are decreased, effectively printing money.
Note: transferNotionalFrom can be called via transferVaultNotional by everyone.
Proof of Concept
https://github.com/Swivel-Finance/gost/blob/v2/test/vaulttracker/VaultTracker.sol#L144-L196
solidity
  function transferNotionalFrom(address f, address t, uint256 a) external onlyAdmin(admin) returns (bool) {
  Vault memory from = vaults\[f];
  Vault memory to = vaults\[t];
  ...
  vaults\[f] = from;
  ...
  vaults\[t] = to;    // if f==t then this will overwrite vaults\[f]
https://github.com/Swivel-Finance/gost/blob/v2/test/marketplace/MarketPlace.sol#L234-L238
solidity
  function transferVaultNotional(address u, uint256 m, address t, uint256 a) public returns (bool) {
  require(VaultTracker(markets\[u]\[m].vaultAddr).transferNotionalFrom(msg.sender, t, a), 'vault transfer failed');
Tools Used
Recommended Mitigation Steps
Add something like the following:
require (f != t,"Same");
JTraversa (Swivel) confirmed


## [H-02]  "Tokens can be stolen when depositToken == rewardToken"

Submitted by cmichel, also found by 0x0x0x, gzeon, Ruhum, gpersoon, hack3r-0m, and pauliax
The Streaming contract allows the deposit and reward tokens to be the same token.

I believe this is intended, think Sushi reward on Sushi as is the case with xSushi.

The reward and deposit balances are also correctly tracked independently in depositTokenAmount and rewardTokenAmount.
However, when recovering tokens this leads to issues as the token is recovered twice, once for deposits and another time for rewards:
```solidity
function recoverTokens(address token, address recipient) public lock {
    // NOTE: it is the stream creators responsibility to save
    // tokens on behalf of their users.
    require(msg.sender == streamCreator, "!creator");
    if (token == depositToken) {
        require(block.timestamp > endDepositLock, "time");
        // get the balance of this contract
        // check what isnt claimable by either party
        // @audit-info depositTokenAmount updated on stake/withdraw/exit, redeemedDepositTokens increased on claimDepositTokens
        uint256 excess = ERC20(token).balanceOf(address(this)) - (depositTokenAmount - redeemedDepositTokens);
        // allow saving of the token
        ERC20(token).safeTransfer(recipient, excess);
    emit RecoveredTokens(token, recipient, excess);
    return;
}

if (token == rewardToken) {
    require(block.timestamp > endRewardLock, "time");
    // check current balance vs internal balance
    //
    // NOTE: if a token rebases, i.e. changes balance out from under us,
    // most of this contract breaks and rugs depositors. this isn't exclusive
    // to this function but this function would in theory allow someone to rug
    // and recover the excess (if it is worth anything)

    // check what isnt claimable by depositors and governance
    // @audit-info rewardTokenAmount increased on fundStream
    uint256 excess = ERC20(token).balanceOf(address(this)) - (rewardTokenAmount + rewardTokenFeeAmount);
    ERC20(token).safeTransfer(recipient, excess);

    emit RecoveredTokens(token, recipient, excess);
    return;
}
// ...

```
Proof Of Concept
Given recoverTokens == depositToken, Stream creator calls recoverTokens(token = depositToken, creator).

The token balance is the sum of deposited tokens (minus reclaimed) plus the reward token amount. ERC20(token).balanceOf(address(this)) >= (depositTokenAmount - redeemedDepositTokens) + (rewardTokenAmount + rewardTokenFeeAmount)
if (token == depositToken) executes, the excess from the deposit amount will be the reward amount (excess >= rewardTokenAmount + rewardTokenFeeAmount). This will be transferred.
if (token == rewardToken) executes, the new token balance is just the deposit token amount now (because the reward token amount has been transferred out in the step before). Therefore, ERC20(token).balanceOf(address(this)) >= depositTokenAmount - redeemedDepositTokens. If this is non-negative, the transaction does not revert and the creator makes a profit.

Example:

outstanding redeemable deposit token amount: depositTokenAmount - redeemedDepositTokens = 1000
funded rewardTokenAmount (plus rewardTokenFeeAmount fees): rewardTokenAmount + rewardTokenFeeAmount = 500

Creator receives 1500 - 1000 = 500 excess deposit and 1000 - 500 = 500 excess reward.
Impact
When using the same deposit and reward token, the stream creator can steal tokens from the users who will be unable to withdraw their profit or claim their rewards.
Recommended Mitigation Steps
One needs to be careful with using .balanceOf in this special case as it includes both deposit and reward balances.
Add a special case for recoverTokens when token == depositToken == rewardToken and then the excess should be ERC20(token).balanceOf(address(this)) - (depositTokenAmount - redeemedDepositTokens) - (rewardTokenAmount + rewardTokenFeeAmount);
brockelmore (Streaming Protocol) confirmed


## [H-01]  "createPromotion() Lack of input validation for _epochDuration can potentially freeze promotion creator’s funds"

Submitted by WatchPug
https://github.com/pooltogether/v4-periphery/blob/0e94c54774a6fce29daf9cb23353208f80de63eb/contracts/TwabRewards.sol#L88-L116
```solidity
function createPromotion(
    address _ticket,
    IERC20 _token,
    uint216 _tokensPerEpoch,
    uint32 _startTimestamp,
    uint32 _epochDuration,
    uint8 _numberOfEpochs
) external override returns (uint256) {
    _requireTicket(_ticket);
uint256 _nextPromotionId = _latestPromotionId + 1;
_latestPromotionId = _nextPromotionId;

_promotions[_nextPromotionId] = Promotion(
    msg.sender,
    _ticket,
    _token,
    _tokensPerEpoch,
    _startTimestamp,
    _epochDuration,
    _numberOfEpochs
);

_token.safeTransferFrom(msg.sender, address(this), _tokensPerEpoch * _numberOfEpochs);

emit PromotionCreated(_nextPromotionId);

return _nextPromotionId;

}
```
In the current implementation of createPromotion(), _epochDuration is allowed to be 0.
However, when _epochDuration = 0, it will be impossible for users to claim the rewards, and the promotion creator won't be able to cancel it.
Proof of Concept

Alice called createPromotion() to create a promotion with the following parameters:
_token: USDC
_tokensPerEpoch: 10,000
_epochDuration: 0
_numberOfEpochs: 10


100,000 USDC was transferred from Alice to the TwabRewards contract;
Users tries to claimRewards() but the transaction always revert at _ticket.getAverageTotalSuppliesBetween() -> TwabLib.getAverageBalanceBetween() due to div by 0.
Alice tries to cancelPromotion() to retrieve the funds, but it always reverts at _requirePromotionActive() since the promotion already ended.

As a result, Alice's 100,000 USDC is frozen in the contract.
Recommendation
Consider adding require(_epochDuration > 0) in createPromotion().
PierrickGT (PoolTogether) marked as duplicate:

Duplicate of https://github.com/code-423n4/2021-12-pooltogether-findings/issues/29

LSDan (judge) commented:

I do not consider this to be a duplicate of #29 because the warden in #29 does not mention this specific failure case. This is indeed an easy to encounter bug that can be triggered as the result of a user error or a frontend bug. Loss of all funds for the promotion would be the result.

PierrickGT (PoolTogether) confirmed and resolved:

Implemented the suggested require: https://github.com/pooltogether/v4-periphery/blob/e0010b689fb170daac77af5f62abba7ca1397524/contracts/TwabRewards.sol#L126



## [H-02]  "Backdated _startTimestamp can lead to loss of funds"

Submitted by csanuragjain, also found by defsec, leastwood, and pauliax
Impact
This can lead to loss of funds as there is no recovery function of funds stuck like this
Proof of Concept


User A creates a new promotion using createPromotion function. By mistake he provides 1 year ago value for \_startTimestamp with promotion duration as 6 months


Since there is no check to see that \_startTimestamp > block.timestamp so this promotion gets created


User cannot claim this promotion if they were not having promotion tokens in the 1 year old promotion period. This means promotion amount remains with contract


Even promotion creator cannot claim back his tokens since promotion end date has already passed so cancelPromotion will fail


As there is no recovery token function in contract so even contract cant transfer this token and the tokens will remain in this contract with no one able to claim those


Recommended Mitigation Steps
Add below check in the createPromotion function
solidity
function createPromotion(
    address _ticket,
    IERC20 _token,
    uint216 _tokensPerEpoch,
    uint32 _startTimestamp,
    uint32 _epochDuration,
    uint8 _numberOfEpochs
) external override returns (uint256) {
    require(_startTimestamp>block.timestamp,"should be after current time");
}
PierrickGT (PoolTogether) confirmed and disagreed with severity:

It would indeed be an unfortunate event and we will implement this require. That being said, funds of the promotion creator would be at risk, because of an error he made, but not funds of a user, so I consider this bug as being of severity 2 (Med Risk) and not 3 (High Risk).

LSDan (judge) commented:

Per the Judge Onboarding document provided by Code423n4, this qualifies as a high risk issue. A UI bug or simple mistake could cause complete loss of funds as sponsor acknowledged.
3 — High (H): vulns have a risk of 3 and are considered “High” severity when assets can be stolen/lost/compromised directly (or indirectly if there is a valid attack path that does not have hand-wavy hypotheticals).



## [H-01]  "Wrong timing of check allows users to withdraw collateral without paying for the debt"

Submitted by WatchPug, also found by IllIllI
TimeswapPair.sol#L459-L490
```solidity
function pay(PayParam calldata param)
    external 
    override 
    lock 
    returns (
        uint128 assetIn, 
        uint128 collateralOut
    ) 
{
    require(block.timestamp < param.maturity, 'E202');
    require(param.owner != address(0), 'E201');
    require(param.to != address(0), 'E201');
    require(param.to != address(this), 'E204');
    require(param.ids.length == param.assetsIn.length, 'E205');
    require(param.ids.length == param.collateralsOut.length, 'E205');
Pool storage pool = pools[param.maturity];

Due[] storage dues = pool.dues[param.owner];
require(dues.length >= param.ids.length, 'E205');

for (uint256 i; i < param.ids.length;) {
    Due storage due = dues[param.ids[i]];
    require(due.startBlock != BlockNumber.get(), 'E207');
    if (param.owner != msg.sender) require(param.collateralsOut[i] == 0, 'E213');
    require(uint256(assetIn) * due.collateral >= uint256(collateralOut) * due.debt, 'E303');
    due.debt -= param.assetsIn[i];
    due.collateral -= param.collateralsOut[i];
    assetIn += param.assetsIn[i];
    collateralOut += param.collateralsOut[i];
    unchecked { ++i; }
}
...

```
At L484, if there is only one id, and for the first and only time of the for loop, assetIn and collateralOut will be 0, therefore require(uint256(assetIn) * due.collateral >= uint256(collateralOut) * due.debt, 'E303'); will pass.
A attacker can call pay() with param.assetsIn[0] == 0 and param.collateralsOut[i] == due.collateral.
Proof of Concept
The attacker can:

borrow() 10,000 USDC with 1 BTC as collateral;
pay() with 0 USDC as assetsIn and 1 BTC as collateralsOut.

As a result, the attacker effectively stole 10,000 USDC.
Recommended Mitigation Steps
Change to:
```solidity
for (uint256 i; i < param.ids.length;) {
    Due storage due = dues[param.ids[i]];
    require(due.startBlock != BlockNumber.get(), 'E207');
    if (param.owner != msg.sender) require(param.collateralsOut[i] == 0, 'E213');
    due.debt -= param.assetsIn[i];
    due.collateral -= param.collateralsOut[i];
    assetIn += param.assetsIn[i];
    collateralOut += param.collateralsOut[i];
    unchecked { ++i; }
}
require(uint256(assetIn) * due.collateral >= uint256(collateralOut) * due.debt, 'E303');
...
```
Mathepreneur (Timeswap) resolved and commented:

Timeswap-Labs/Timeswap-V1-Core@b23b44a

0xleastwood (judge) commented:

This is an interesting find. It appears that assetIn and collateralOut are not checked properly during the first iteration of the for loop. As a result, this functionality of this function is inherently broken as the require statement will always be satisfied. Nice job!


Medium Risk Findings (3)


## [H-01]  "Can deposit native token for free and steal funds"

Submitted by cmichel, also found by CertoraInc
LiquidityPool.sol#L151
The depositErc20 function allows setting tokenAddress = NATIVE and does not throw an error.
No matter the amount chosen, the SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(tokenAddress), sender, address(this), amount); call will not revert because it performs a low-level call to NATIVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE, which is an EOA, and the low-level calls to EOAs always succeed.
Because the safe* version is used, the EOA not returning any data does not revert either.
This allows an attacker to deposit infinite native tokens by not paying anything.
The contract will emit the same Deposit event as a real depositNative call and the attacker receives the native funds on the other chain.
Recommended Mitigation Steps
Check tokenAddress != NATIVE in depositErc20.
ankurdubey521 (Biconomy) confirmed and commented:

HP-25: C4 Audit Fixes, Dynamic Fee Changes bcnmy/hyphen-contract#42

pauliax (judge) commented:

Great find, definitely deserves a severity of high.




