## [H-05]  "Flash loans can affect governance voting in DAO.sol"

Flash loans can significantly increase a single voter's weight and be used to impact the voting outcome. A voter can borrow a significant quantity of tokens to increase their voting weight in a transaction within which, they also deterministically  influence the voting outcome to their choice.
This has already happened in the case of MakerDAO governance where a flash loan was used to affect voting outcome and noted by the Maker team as: “a practical example for the community that flash loans can and may impact system governance”
Given that flash loans are a noted concern, the impact of it to DAO governance which can control all critical protocol parameters should be mitigated as in other places.
Recommend accounting for flash loans in countMemberVotes() by using weight from previous blocks or consider capping the weight of individual voters. (L158-L163)
strictly-scarce (vader) disputed:

Not valid.
All pools use slip-based fees so flash loan attack by buying up USDV or synths is not going to work.

dmvt (judge) commented:

The funds to execute this attack do not need to come from a pool. It could be done as simply as malicious members pooling their funds in a flash loan contract, and each borrowing the funds in turn to vote.



## [H-03]  "LendingPair.liquidateAccount fails if tokens are lent out"

Submitted by cmichel
The LendingPair.liquidateAccount function tries to pay out underlying supply tokens to the liquidator using _safeTransfer(IERC20(supplyToken), msg.sender, supplyOutput) but there's no reason why there should be enough supplyOutput amount in the contract, the contract only ensures minReserve.
As a result, no liquidations can be performed if all tokens are lent out.
Example: User A supplies 1k\$ WETH, User B supplies 1.5k\$ DAI and borrows the ~1k\$ WETH (only leaves minReserve). The ETH price drops but user B cannot be liquidated as there's not enough WETH in the pool anymore to pay out the liquidator.
Recommend minting LP supply tokens to msg.sender instead, these are the LP supply tokens that were burnt from the borrower. This way the liquidator basically seizes the borrower's LP tokens.
talegift (Wild Credit) confirmed but disagreed with severity:

Assets not at direct risk, but the function of the protocol or its availability could be impacted, or leak value with a hypothetical attack path with stated assumptions, but external requirements.
Update to severity - 2

ghoul-sol (Judge) commented:

If liquidation is impossible, there's insolvency risk and that creates a risk to lose user funds. Keeping high severity.

Medium Risk Findings


## [H-04]  "Expired transfers will lock user funds on the sending chain"

Submitted by 0xRajeev
The cancelling relayer is being paid in receivingAssetId on the sendingChain instead of in sendingAssetID. If the user relies on a relayer to cancel transactions, and that receivingAssetId asset does not exist on the sending chain (assuming only sendingAssetID on the sending chain and receivingAssetId on the receiving chain are assured to be valid and present), then the cancel transaction from the relayer will always revert and user’s funds will remain locked on the sending chain.
The impact is that expired transfers can never be cancelled and user funds will be locked forever if user relies on a relayer.
Recommend changing receivingAssetId to sendingAssetId in transferAsset() on TransactionManager.sol L514.
LayneHaber (Connext) confirmed and patched:

https://github.com/connext/nxtp/pull/25



## [H-01]  "PostAuctionLauncher.sol#finalize() Adding liquidity to an existing pool may allows the attacker to steal most of the tokens"

Submitted by WatchPug, also found by 0xRajeev and cmichel.
PostAuctionLauncher.finalize() can be called by anyone, and it sends tokens directly to the pair pool to mint liquidity, even when the pair pool exists.
An attacker may control the LP price by creating the pool and then call finalize() to mint LP token with unfair price (pay huge amounts of tokens and get few amounts of LP token), and then remove the initial liquidity they acquired when creating the pool and take out huge amounts of tokens.
https://github.com/sushiswap/miso/blob/2cdb1486a55ded55c81898b7be8811cb68cfda9e/contracts/Liquidity/PostAuctionLauncher.sol#L257
```solidity
/*
 * @notice Finalizes Token sale and launches LP.
 * @return liquidity Number of LPs.
 /
function finalize() external nonReentrant returns (uint256 liquidity) {
    // GP: Can we remove admin, let anyone can finalise and launch?
    // require(hasAdminRole(msg.sender) || hasOperatorRole(msg.sender), "PostAuction: Sender must be operator");
    require(marketConnected(), "PostAuction: Auction must have this launcher address set as the destination wallet");
    require(!launcherInfo.launched);
if (!market.finalized()) {
    market.finalize();
}
require(market.finalized());

launcherInfo.launched = true;
if (!market.auctionSuccessful() ) {
    return 0;
}

/// @dev if the auction is settled in weth, wrap any contract balance 
uint256 launcherBalance = address(this).balance;
if (launcherBalance > 0 ) {
    IWETH(weth).deposit{value : launcherBalance}();
}

(uint256 token1Amount, uint256 token2Amount) =  getTokenAmounts();

/// @dev cannot start a liquidity pool with no tokens on either side
if (token1Amount == 0 || token2Amount == 0 ) {
    return 0;
}

address pair = factory.getPair(address(token1), address(token2));
if(pair == address(0)) {
    createPool();
}

/// @dev add liquidity to pool via the pair directly
_safeTransfer(address(token1), tokenPair, token1Amount);
_safeTransfer(address(token2), tokenPair, token2Amount);
liquidity = IUniswapV2Pair(tokenPair).mint(address(this));
launcherInfo.liquidityAdded = BoringMath.to128(uint256(launcherInfo.liquidityAdded).add(liquidity));

/// @dev if unlock time not yet set, add it.
if (launcherInfo.unlock == 0 ) {
    launcherInfo.unlock = BoringMath.to64(block.timestamp + uint256(launcherInfo.locktime));
}
emit LiquidityAdded(liquidity);

}
```
In line 257, PostAuctionLauncher will mint LP with token1Amount and token2Amount. The amounts (token1Amount and token2Amount) are computed according to the auction result, without considering the current price (reserves) of the existing tokenPair.
See PostAuctionLauncher.getTokenAmounts()
PostAuctionLauncher will receive an unfairly low amount of lp token because the amounts sent to tokenPair didn't match the current price of the pair.
See UniswapV2Pair.mint(...)
solidity
liquidity = MathUniswap.min(amount0.mul(_totalSupply) / _reserve0, amount1.mul(_totalSupply) / _reserve1);
Impact
Lose a majority share of the tokens.
Proof of Concept

The attacker creates LP with 0.0000001 token1 and 1000 token2, receives 0.01 LP token;
Call PostAuctionLauncher.finalize(). PostAuctionLauncher will mint liquidity with 2000 token1 and 1000 token2 for example, receives only  0.01 LP token;
The attacker removes all his LP, receives 1000 token1 (most of which come from PostAuctionLauncher).

Recommended Mitigation Steps
To only support tokenPair created by PostAuctionLauncher or check for the token price before mint liquidity.
Clearwood (Sushi Miso) confirmed and patched:

https://github.com/sushiswap/miso/pull/21



## [H-02]  "Liquidation can be escaped by depositing a Uni v3 position with 0 liquidity"

Submitted by WatchPug.
When the liquidator is trying to liquidate a undercolldarezed loan by calling liquidateAccount(), it calls _unwrapUniPosition() -> uniV3Helper.removeLiquidity() -> positionManager.decreaseLiquidity().
However, when the Uni v3 position has 0 liquidity, positionManager.decreaseLiquidity() will fail.
See: https://github.com/Uniswap/v3-periphery/blob/main/contracts/NonfungiblePositionManager.sol#L265
Based on this, a malicious user can escaped liquidation by depositing a Uni v3 position with 0 liquidity.
Impact
Undercollateralized debts cannot be liquidated and it leads to bad debts to the protocol.
A malicious user can take advantage of this by creating long positions on the collateral assets and take profit on the way up, and keep taking more debt out of the protocol, while when the price goes down, the debt can not be liquidated and the risks of bad debt are paid by the protocol.
Proof of Concept

A malicious user deposits some collateral assets and borrow the max amount of debt;
The user deposits a Uni v3 position with 0 liquidity;
When the market value of the collateral assets decreases, the liquadation will fail as positionManager.decreaseLiquidity() reverts.

Recommendation
Check if liquidity > 0 when removeLiquidity.
talegift (Wild Credit) confirmed:

Valid issue. Good catch.
Severity should be lowered to 2 as it doesn't allow direct theft of funds and the loss would only occur under specific external conditions.
2 — Med: Assets not at direct risk, but the function of the protocol or its availability could be impacted, or leak value with a hypothetical attack path with stated assumptions, but external requirements
https://docs.code4rena.com/roles/wardens/judging-criteria#estimating-risk-tl-dr

ghoul-sol (judge) commented:

To my understanding, bad position would affect the whole protocol and a loss would have to be paid by other participans which means funds can be drained. For that reason, I'm keeping high risk.

Medium Risk Findings (4)


## [H-04]  "WrappedIbbtc and WrappedIbbtcEth contracts do not filter out price feed outliers"

Submitted by hyh
Impact
If price feed is manipulated in any way or there is any malfunction based volatility on the market, both contracts will pass it on a user.
In the same time it's possible to construct mitigation mechanics for such cases, so user economics would be affected by sustainable price movements only.
As price outrages provide a substantial attack surface for the project it's worth adding some complexity to the implementation.
Proof of Concept
In WrappedIbbtcEth pricePerShare variable is updated by externally run updatePricePerShare function (WrappedIbbtcEth.sol L72), and then used in mint/burn/transfer functions without additional checks via balanceToShares function: WrappedIbbtcEth.sol L155
In WrappedIbbtc price is requested via pricePerShare function(WrappedIbbtc.sol L123), and used in the same way without additional checks via balanceToShares function.
Recommended Mitigation Steps
Introduce a minting/burning query that runs on a schedule, separating user funds contribution and actual mint/burn. With user deposit or burn, the corresponding action to be added to commitment query, which execution for mint or redeem will later be sparked by off-chain script according to fixed schedule.
This also can be open to public execution with gas compensation incentive, for example as it's done in Tracer protocol: PoolKeeper.sol L131
Full code of an implementation is too big to include in the report, but viable versions are available publicly (Tracer protocol version can be found at the same repo, implementation/PoolCommitter sol
).
Once the scheduled mint/redeem query is added, the additional logic to control for price outliers will become possible there, as in this case mint/redeem execution can be conditioned to happen on calm market only, where various definitions of calm can be implemented.
One of the approaches is to keep track of recent prices and require that new price each time be within a threshold from median of their array.
Example:
```solidity
// Introduce small price tracking arrays:
uint256[] private times;
uint256[] private prices;
// Current position in array
uint8 curPos;
// Current length, grows from 0 to totalMaxPos as prices are being added
uint8 curMaxPos;
// Maximum length, we track up to totalMaxPos prices
uint8 totalMaxPos = 10;
// Price movement threshold
uint256 moveThreshold = 0.1*1e18;
```
We omit the full implementation here as it is lengthy enough and can vary.
The key steps are:
*   Run query for scheduled mint/redeem with logic: if next price is greater than median of currently recorded prices by threshold, add it to the records, but do not mint/redeem.
*   That is, when scheduled mint/redeem is run, on new price request, WrappedIbbtcEth.core.pricePerShare() or WrappedIbbtc.oracle.pricePerShare(), get newPrice and calculate current price array median, curMed
*   prices[curPos] = newPrice
*   if (curMaxPos < totalMaxPos) {curMaxPos += 1}
*   if (curPos == curMaxPos) {curPos = 0} else {curPos += 1}
*   if (absolute_value_of(newPrice - curMed) < moveThreshold * curMed / 1e18) {do_mint/redeem; return_0_status}
*   else {return_1_status}
Schedule should be frequent enough, say once per 30 minutes, which is kept while returned status is 0. While threshold condition isn't met and returned status is 1, it runs once per 10 minutes. The parameters here are subject to calibration.
This way if the price movement is sustained the mint/redeem happens after price array median comes to a new equilibrium. If price reverts, the outbreak will not have material effect mint/burn operations. This way the contract vulnerability is considerably reduced as attacker would need to keep distorted price for period long enough, which will happen after the first part of deposit/withdraw cycle. I.e. deposit and mint, burn and redeem operations will happen not simultaneously, preventing flash loans to be used to elevate the quantities, and for price to be effectively distorted it would be needed to keep it so for substantial amount of time.
dapp-whisperer (BadgerDAO) confirmed:

Minting and burning happens atomically within larger function calls and our current approach isn't amenable to this change.

Medium Risk Findings (4)


## [H-07]  "SavingsAccount withdrawAll and switchStrategy can freeze user funds by ignoring possible strategy liquidity issues"

Submitted by hyh, also found by cmichel
Impact
Full withdrawal and moving funds between strategies can lead to wrong accounting if the corresponding market has tight liquidity, which can be the case at least for AaveYield. That is, as the whole amount is required to be moved at once from Aave, both withdrawAll and switchStrategy will incorrectly account for partial withdrawal as if it was full whenever the corresponding underlying yield pool had liquidity issues.
withdrawAll will delete user entry, locking the user funds in the strategy: user will get partial withdrawal and have the corresponding accounting entry removed, while the remaining actual funds will be frozen within the system.
switchStrategy will subtract full number of shares for the _amount requested from the old strategy, while adding lesser partial number of shares for _tokensReceived to the new one with the same effect of freezing user's funds within the system.
Proof of Concept
SavingsAccount.withdrawAll
https://github.com/code-423n4/2021-12-sublime/blob/main/contracts/SavingsAccount/SavingsAccount.sol#L286
SavingsAccount.switchStrategy:
https://github.com/code-423n4/2021-12-sublime/blob/main/contracts/SavingsAccount/SavingsAccount.sol#L152
When full withdrawal or strategy switch is performed it is one withdraw via unlockTokens without checking the amount received.
In the same time the withdraw can fail for example for the strategy switch if old strategy is having liquidity issues at the moment, i.e. Aave market is currently have utilization rate too high to withdraw the amount requested given current size of the lending pool.
Aave unlockTokens return is correctly not matched with amount requested:
https://github.com/code-423n4/2021-12-sublime/blob/main/contracts/yield/AaveYield.sol#L217
But, for example, withdrawAll ignores the fact that some funds can remain in the strategy and deletes the use entry after one withdraw attempt:
https://github.com/code-423n4/2021-12-sublime/blob/main/contracts/SavingsAccount/SavingsAccount.sol#L294
https://github.com/code-423n4/2021-12-sublime/blob/main/contracts/SavingsAccount/SavingsAccount.sol#L312
switchStrategy removes the old entry completely:
https://github.com/code-423n4/2021-12-sublime/blob/main/contracts/SavingsAccount/SavingsAccount.sol#L181
Recommended Mitigation Steps
For both withdrawAll and switchStrategy the immediate fix is to account for tokens received in both cases, which are _amount after unlockTokens for withdrawAll and _tokensReceived for switchStrategy.
More general handling of the liquidity issues ideally to be addressed architecturally, given the potential issues with liquidity availability any strategy withdrawals can be done as follows:

Withdraw what is possible on demand, leave the amount due as is, i.e. do not commit to completing the action in one go and notify the user the action was partial (return actual amount)
Save to query and repeat for the remainder funds on the next similar action (this can be separate flag triggered mode)

ritik99 (Sublime) disagreed with severity:

The above issue requires making a few assumptions - (i) the underlying yield protocol does not have sufficient reserves to facilitate the withdrawal of a single user, (ii) the user attempts to withdraw all their assets during such times of insufficient reserves.
We agree that the above could be a possibility, but would be unlikely. The underlying yield protocols undergo an interest rate spike during high utilization ratios to bring reserves back to normal levels, and some revert if they cannot withdraw the necessary amount (for eg, Compound). During live deployment, only those strategies that work expectedly would be onboarded, while others wouldn't (for eg, Aave as a strategy wouldn't be integrated until their wrappers for aTokens are ready for use). Hence we suggest reducing severity to (2) medium-risk
also similar to #144 

0xean (judge) commented:

While I understand the argument regarding this being an unlikely scenario, I don't believe that is a sufficient reason to downgrade the issue give the impact to a user and the lost funds.  
2 — Med: Assets not at direct risk, but the function of the protocol or its availability could be impacted, or leak value with a hypothetical attack path with stated assumptions, but external requirements.
In this scenario - Assets are at a direct risk. 



## [H-09]  "PriceOracle Does Not Filter Price Feed Outliers"

Submitted by leastwood
Impact
If for whatever reason the Chainlink oracle returns a malformed price due to oracle manipulation or a malfunctioned price, the result will be passed onto users, causing unintended consequences as a result.
In the same time it's possible to construct mitigation mechanics for such cases, so user economics be affected by sustainable price movements only. As price outrages provide a substantial attack surface for the project it's worth adding some complexity to the implementation.
Proof of Concept
https://github.com/code-423n4/2021-12-sublime/blob/main/contracts/PriceOracle.sol#L149-L161
solidity
function getLatestPrice(address num, address den) external view override returns (uint256, uint256) {
    uint256 _price;
    uint256 _decimals;
    (_price, _decimals) = getChainlinkLatestPrice(num, den);
    if (_decimals != 0) {
        return (_price, _decimals);
    }
    (_price, _decimals) = getUniswapLatestPrice(num, den);
    if (_decimals != 0) {
        return (_price, _decimals);
    }
    revert("PriceOracle::getLatestPrice - Price Feed doesn't exist");
}
The above code outlines how prices are utilised regardless of their actual value (assuming it is always a non-zero value).
Recommended Mitigation Steps
Consider querying both the Chainlink oracle and Uniswap pool for latest prices, ensuring that these two values are within some upper/lower bounds of each other. It may also be useful to track historic values and ensure that there are no sharp changes in price. However, the first option provides a level of simplicity as UniswapV3's TWAP implementation is incredibly resistant to flash loan attacks. Hence, the main issue to address is a malfunctioning Chainlink oracle.
ritik99 (Sublime) disputed:

The described suggestion is fairly complex - besides the increase in code complexity, we'd also have to decide the bounds within which the Uniswap and Chainlink oracles should report prices that won't be trivial. We've also noted in the assumptions section of our contest repo that oracles are assumed to be accurate

0xean (judge) commented:

" We expect these feeds to be fairly reliable." - Based on this quote, I am going to leave this open at the current risk level.  These are valid changes that could significantly reduce the risk of the implementation and unintended liquidations. 
Fairly reliable != 100% reliable




## [H-01]  "Tokens can be burned with no access control"

Submitted by sirhashalot
The Vault.sol contract has two address state variables, the keeper variable and the controller variable, which are both permitted to be the zero address. If both variables are zero simultaneously, any address can burn the available funds (available funds = balance - totalDebt) by sending these tokens to the zero address with the unprotected utilitize() function. If a user has no totalDebt, the user can lose their entire underlying token balance because of this.
Proof of Concept
The problematic utilize() function is found here. To see how the two preconditions can occur:

The keeper state variable is only changed by the setKeeper() function found here. If this function is not called, the keeper variable will retain the default value of address(0), which bypasses the only access control for the utilize function.
There is a comment here on line 69 stating the controller state variable can be zero. There is no zero address check for the controller state variable in the Vault constructor.

If both address variables are left at their defaults of address(0), then the safeTransfer() call on line 348 would send the tokens to address(0).
Recommended Mitigation Steps
Add the following line to the very beginning of the utilize() function:
require(address(controller) != address(0))
This check is already found in many other functions in Vault.sol, including the _unutilize() function.
oishun1112 (Insure) confirmed and resolved:

https://github.com/InsureDAO/pool-contracts/blob/audit/code4rena/contracts/Vault.sol#L382



## [H-02]  "The return value success of the get function of the INFTOracle interface is not checked"

Submitted by cccz, also found by Ruhum, catchup, IllIllI, WatchPug, berndartmueller, plotchy, antonttc, hyh, and 0xf15ers
    function get(address pair, uint256 tokenId) external returns (bool success, uint256 rate);

The get function of the INFTOracle interface returns two values, but the success value is not checked when used in the NFTPairWithOracle contract. When success is false, NFTOracle may return stale data.
Proof of Concept
https://github.com/code-423n4/2022-04-abranft/blob/5cd4edc3298c05748e952f8a8c93e42f930a78c2/contracts/interfaces/INFTOracle.sol#L10-L10 
https://github.com/code-423n4/2022-04-abranft/blob/5cd4edc3298c05748e952f8a8c93e42f930a78c2/contracts/NFTPairWithOracle.sol#L287-L287
https://github.com/code-423n4/2022-04-abranft/blob/5cd4edc3298c05748e952f8a8c93e42f930a78c2/contracts/NFTPairWithOracle.sol#L321-L321
Recommended Mitigation Steps
(bool success, uint256 rate) = loanParams.oracle.get(address(this), tokenId);
require(success);

cryptolyndon (AbraNFT) confirmed and commented:

Agreed, and the first report of this issue.

0xean (judge) increased severity to High and commented:

I am upgrading this to High severity. 
This is a direct path to assets being lost. 
3 — High: Assets can be stolen/lost/compromised directly (or indirectly if there is a valid attack path that does not have hand-wavy hypotheticals).




## [H-01]  "Hard-coded slippage may freeze user funds during market turbulence"

Submitted by jonah1005, also found by berndartmueller, Picodes, IllIllI, sorrynotsorry, and WatchPug
GeneralVault.sol#L125
GeneralVault set a hardcoded slippage control of 99%. However, the underlying yield tokens price may go down.
If Luna/UST things happen again, users' funds may get locked.
LidoVault.sol#L130-L137
Moreover, the withdrawal of the lidoVault takes a swap from the curve pool. 1 stEth worth 0.98 ETH at the time of writing.
The vault can not withdraw at the current market.
Given that users' funds would be locked in the lidoVault, I consider this a high-risk issue.
Proof of Concept
1 stEth  = 0.98 Eth
LidoVault.sol#L130-L137
Recommended Mitigation Steps
There are different ways to set the slippage.
The first one is to let users determine the maximum slippage they're willing to take.
The protocol front-end should set the recommended value for them.
solidity
  function withdrawCollateral(
    address _asset,
    uint256 _amount,
    address _to,
    uint256 _minReceiveAmount
  ) external virtual {
      // ...
    require(withdrawAmount >= _minReceiveAmount, Errors.VT_WITHDRAW_AMOUNT_MISMATCH);
  }
The second one is have a slippage control parameters that's set by the operator.
solidity
    // Exchange stETH -> ETH via Curve
    uint256 receivedETHAmount = CurveswapAdapter.swapExactTokensForTokens(
      _addressesProvider,
      _addressesProvider.getAddress('STETH_ETH_POOL'),
      LIDO,
      ETH,
      yieldStETH,
      maxSlippage
    );
```solidity
    function setMaxSlippage(uint256 _slippage) external onlyOperator {
        maxSlippage = _slippage;
    //@audit This action usually emit an event.
    emit SetMaxSlippage(msg.sender, slippage);
}

```
These are two common ways to deal with this issue. I prefer the first one.
The market may corrupt really fast before the operator takes action.
It's nothing fun watching the number go down while having no option.
sforman2000 (Sturdy) confirmed
iris112 (Sturdy) commented:

Fix the issue of require 99% of withdrawAmount sturdyfi/code4rena-may-2022#11

hickuphh3 (judge) commented:

I realise there are 2 issues discussed here:
1) The high-risk severity relates to GeneralVault's tight 1% slippage. Because it is inherited by vaults, it can cause withdrawals to fail and for user funds to be stuck.
2) However, in the context of the LIDO vault specifically, #69's first low-severity issue rightly points out that users can choose to withdraw their funds in stETH, then do conversion to ETH separately afterwards. Hence, funds won't actually be stuck. I would've therefore classified this a medium-severity issue. Nevertheless, it is expected that users will attempt to withdraw to ETH instead of stETH in times of market volatility.




## [H-01]  "Oracle data feed can be outdated yet used anyways which will impact payment logic"

Submitted by 0xNineDec, also found by 0x1f8b, 0x29A, 0x52, 0xdanial, 0xDjango, 0xf15ers, bardamu, cccz, Cheeezzyyyy, Chom, codexploder, defsec, Franfran, Alex the Entreprenerd, Green, hake, hansfriese, horsefacts, hubble, hyh, IllIllI, jonatascm, kebabsec, Meera, oyc_109, pashov, rbserver, Ruhum, simon135, tabish, tintin, and zzzitron
https://github.com/jbx-protocol/juice-contracts-v2-code4rena/blob/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBChainlinkV3PriceFeed.sol#L44
https://github.com/jbx-protocol/juice-contracts-v2-code4rena/blob/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBPrices.sol#L57
https://github.com/jbx-protocol/juice-contracts-v2-code4rena/blob/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBSingleTokenPaymentTerminalStore.sol#L387
https://github.com/jbx-protocol/juice-contracts-v2-code4rena/blob/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBSingleTokenPaymentTerminalStore.sol#L585
https://github.com/jbx-protocol/juice-contracts-v2-code4rena/blob/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBSingleTokenPaymentTerminalStore.sol#L661
https://github.com/jbx-protocol/juice-contracts-v2-code4rena/blob/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBSingleTokenPaymentTerminalStore.sol#L830
https://github.com/jbx-protocol/juice-contracts-v2-code4rena/blob/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBSingleTokenPaymentTerminalStore.sol#L868
Impact
The current implementation of JBChainlinkV3PriceFeed is used by the protocol to showcase how the feed will be retrieved via Chainlink Data Feeds. The feed is used to retrieve the currentPrice, which is also used afterwards by JBPrices.priceFor(), then by JBSingleTokenPaymentTerminalStore.recordPaymentFrom(), JBSingleTokenPaymentTerminalStore.recordDistributionFor, JBSingleTokenPaymentTerminalStore.recordUsedAllowanceOf, JBSingleTokenPaymentTerminalStore._overflowDuring and JBSingleTokenPaymentTerminalStore._currentTotalOverflowOf.
Although the current feeds are calculated by a non implemented IJBPriceFeed, if the implementation of the price feed is the same as the showcased inJBChainlinkV3PriceFeed, the retrieved data can be outdated or out of bounds.
It is important to remember that the sponsor said on the dedicated Discord Channel that also oracle pricing and data retrieval is inside the scope.
Proof of Concept
Chainlink classifies their data feeds into four different groups regarding how reliable is each source thus, how risky they are. The groups are Verified Feeds, Monitored Feeds, Custom Feeds and Specialized Feeds (they can be seen here). The risk is the lowest on the first one and highest on the last one.
A strong reliance on the price feeds has to be also monitored as recommended on the Risk Mitigation section. There are several reasons why a data feed may fail such as unforeseen market events, volatile market conditions, degraded performance of infrastructure, chains, or networks, upstream data providers outage, malicious activities from third parties among others.
Chainlink recommends using their data feeds along with some controls to prevent mismatches with the retrieved data. Along some recommendations, the feed can include circuit breakers (for extreme price events), contract update delays (to ensure that the injected data into the protocol is fresh enough), manual kill-switches (to cease connection in case of found bug or vulnerability in an upstream contract), monitoring (control the deviation of the data) and soak testing (of the price feeds).
The feed.lastRoundData() interface parameters according to Chainlink are the following:
function latestRoundData() external view
 returns (
 uint80 roundId, // The round ID.
 int256 answer, // The price.
 uint256 startedAt, // Timestamp of when the round started.
 uint256 updatedAt, // Timestamp of when the round was updated.
 uint80 answeredInRound // The round ID of the round in which the answer was computed.
 )
Regarding Juicebox itself, only the answer is used on the JBChainlinkV3PriceFeed.currentPrice() implementation. The retrieved price of the priceFeed can be outdated and used anyways as a valid data because no timestamp tolerance of the update source time is checked while storing the return parameters of feed.latestRoundData() inside JBChainlinkV3PriceFeed.currentPrice() as recommended by Chainlink in here. The usage of outdated data can impact on how the Payment terminals work regarding pricing calculation and value measurement.
Precisely the following protocol logic within JBSingleTokenPaymentTerminalStore​‌ will work unexpectedly regarding value management.

recordPaymentFrom():

This function handles the minting of a project tokens according to a data source if one is given. If the retrieved value of the oracle is outdated, the _weightRatio at Line 387 will return an incorrect value and then the tokenCount calculated amount will suffer from this mismatch, impacting in the amount of tokens minted.
* recordDistributionFor():
Performs the recording of recently distributed funds for a project. On line 580 the distributedAmount is computed and if the boolean check is false, then the call will perform a call to priceFor at line 585. If the returned oracle value is not adjusted with current market prices, the distributedAmount will also drag that error computing an incorrect distributedAmount. Afterwards, because the distributedAmount is also used to update the token balances of the msg.sender (line 598) it means that the mismatch impacts on the modified balance.
* recordUsedAllowanceOf():
Keeps record of used allowances of a project. It returns are analogue to the ones shown at recordDistributionFor where the usedAmount resembles the distributedAmount. The usedAmount is also used to update the project’s balance. If the data of the oracle is outdated, the usedAmount will be calculated dragging that error.
* _overflowDuring():
Used to get the amount that is overflowing relative to a specified cycle. The data retrieved from the oracle is used to calculate the value of _distributionLimitRemaining on line 827 which is used later to calculate the return value if the boolean check performed at line 834 is true. Because the return of this function is the current balance of a project minus the amount that can be still distributed, if the amount that can still be distributed is wrong so will be the subtraction thus the return value.
* _currentTotalOverflowOf():
Similar to the latter but used to get the overflow of all the terminals of a project. If the retrieved data has a mismatch with the market, the _totalOverflow18Decimal calculated on line 866 if the boolean check is false will drag this mismatch which will also be dragged into the final return of the function.
The issues of those miscalculations impact on every project currently minted, which also affects subsequently on each user that has tokens of a project resulting in a high reach impact.
Recommended Mitigation Steps
As Chainlink recommends:

Your application should track the latestTimestamp variable or use the updatedAt value from the latestRoundData() function to make sure that the latest answer is recent enough for your application to use it. If your application detects that the reported answer is not updated within the heartbeat or within time limits that you determine are acceptable for your application, pause operation or switch to an alternate operation mode while identifying the cause of the delay.
During periods of low volatility, the heartbeat triggers updates to the latest answer. Some heartbeats are configured to last several hours, so your application should check the timestamp and verify that the latest answer is recent enough for your application.

It is recommended to add a tolerance that compares the updatedAt return timestamp from latestRoundData() with the current block timestamp and ensure that the priceFeed is being updated with the required frequency.
If the ETH/USD is the only one that is needed to retrieve, because it is the most popular and available pair. It can also be useful to add other oracle to get the price feed (such as Uniswap’s). This can be used as a redundancy in the case of having one oracle that returns outdated values (what is outdated and what is up to date can be determined by a tolerance as mentioned).
mejango (Juicebox) confirmed, but disagreed with severity and commented:

There is also a good description in this duplicate #78

mejango (Juicebox) resolved:

PR with fix: PR #1

berndartmueller (warden) reviewed mitigation:

Appropriate validations to prevent price staleness, round incompleteness and a negative price is put in place now.




## [H-08]  "Incorrect Assumption of Stablecoin Market Stability"

Submitted by 0xsomeone, also found by Critical, __141345__, Tointer, Secureverse, SamGMK, rotcivegaf, 0xhacksmithh, 8olidity, Ruhum, and aviggiano
https://github.com/code-423n4/2022-12-tigris/blob/main/contracts/StableVault.sol#L39-L51 
https://github.com/code-423n4/2022-12-tigris/blob/main/contracts/StableVault.sol#L60-L72
Impact
The StableVault contract attempts to group all types of stablecoins under a single token which can be minted for any of the stablecoins supported by the system as well as burned for any of them.
This is at minimum a medium-severity vulnerability as the balance sheet of the StableVault will consist of multiple assets which do not have a one-to-one exchange ratio between them as can be observed by trading pools such as Curve as well as the Chainlink oracle reported prices themselves.
Given that the contract exposes a 0% slippage 1-to-1 exchange between assets that in reality have varying prices, the balance sheet of the contract can be arbitraged (especially by flash-loans) to swap an undesirable asset (i.e. USDC which at the time of submission was valued at 0.99994853 USD) for a more desirable asset (i.e. USDT which at the time of submission was valued at 1.00000000 USD) acquiring an arbitrage in the price by selling the traded asset.
Proof of Concept
To illustrate the issue, simply view the exchange output you would get for swapping your USDC to USDT in a stablecoin pool (i.e. CurveFi) and then proceed to invoke deposit with your USDC asset and retrieve your incorrectly calculated USDT equivalent via withdraw.
The arbitrage can be observed by assessing the difference in the trade outputs and can be capitalized by selling our newly acquired USDT for USDC on the stablecoin pair we assessed earlier, ultimately ending up with a greater amount of USDC than we started with. This type of attack can be extrapolated by utilizing a flash-loan rather than our personal funds.
Tools Used
Chainlink oracle resources
Curve Finance pools
Recommended Mitigation Steps
We advise the StableVault to utilize Chainlink oracles for evaluating the inflow of assets instead, ensuring that all inflows and outflows of stablecoins are fairly evaluated based on their "neutral" USD price rather than their subjective on-chain price or equality assumption.
Alex the Entreprenerd (judge) increased severity to High and commented:

The warden has shown how, due to an incorrect assumption, the system offers infinite leverage.
This can be trivially exploited by arbitraging with any already available exchange.
Depositors will incur a loss equal to the size of the arbitrage as the contract is always taking the losing side.
I believe this should be High because of it's consistently losing nature.

TriHaz (Tigris Trade) acknowledged and commented:

We are aware of this issue, we will keep the vault with one token for now.




