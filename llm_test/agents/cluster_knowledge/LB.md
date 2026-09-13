## [H-16]  "Tokens can be stolen through transferTo"

I know that it's stated that:

VADER, USDV, SYNTHS all employ the transferTo() function, which interrogates for tx.origin and skips approvals. The author does not subscribe to the belief that this is dangerous

In my opinion, it can be very dangerous. Imagine the following scenario:

I create a custom attacker ERC20 token that has a hook in the _transfer function that checks tx.origin for USDV/VADER/SYNTHS and calls transferTo to steal these funds.
I set up a honeypot by providing liquidity to the BASE <> ATTACKER pool.
I target high-profile accounts holdinging VADER/USDV/SYNTHS and airdrop them free tokens.
Block explorers / Vader swap websites could show that this token has value and can be traded for actual BASE tokens.
User wants to sell the airdropped ATTACKER token to receive valuable tokens through the Vader swap and has all their tokens (that are even completely unrelated to the tokens being swapped) stolen.

In general, a holder of any of the core assets of the protocol risks all their funds being stolen if they ever interact with an unvetted external contract/token.
This could even be completely unrelated to the VADER protocol.
Recommend removing transferTo and use permit + transferFrom instead to move tokens from tx.origin.
strictly-scarce (vader) acknowledged:

This attack path has already been assessed as the most likely, no new information is being presented here.
Do not interact with attack contracts, interacting with an ERC20 is an attack contract.

0xBrian commented:

@strictly-scarce (vader) What would be the downside of adopting the suggested mitigation? Since we cannot communicate effectively with all users to tell them not to interact with certain kinds of contracts (and even if we could, they may not be able to discern which are OK and which aren't), we don't want to set up a thicket for fraudsters to operate. If the downside of the mitigation is not too bad, I think it could be worth it in order to deny fraudsters an opportunity to steal.

Mervyn853 commented:

Our decision matrix for severity:
0: No-risk: Code style, clarity, off-chain monitoring (events etc), exclude gas-optimisations
1: Low Risk: UX, state handling, function incorrect as to spec
2: Funds-Not-At-Risk, but can impact the functioning of the protocol, or leak value with a hypothetical attack path with stated assumptions, but external requirements
3: Funds can be stolen/lost directly, or indirectly if a valid attack path shown that does not have handwavey hypotheticals.
Recommended: 0



## [H-22]  "Users may unintentionally remove liquidity under a phishing attack."

The removeLiquidity function in Pools.sol uses tx.origin to determine the person who wants to remove liquidity. However, such a design is dangerous since the pool assumes that this function is called from the router, which may not be true if the user is under a phishing attack, and he could unintentionally remove liquidity.
Referenced code: Pool.sol#L77-L79
Recommend consider making the function _removeLiquidity external, which can be utilized by the router, providing information of which person removes his liquidity.
strictly-scarce (vader) acknowledged:

If a user has been phished, consider all their funds already stolen.
Vader's security assumption is a user is not phished.

Mervyn853 commented:

Our decision matrix for severity:
0: No-risk: Code style, clarity, off-chain monitoring (events etc), exclude gas-optimisations
1: Low Risk: UX, state handling, function incorrect as to spec
2: Funds-Not-At-Risk, but can impact the functioning of the protocol, or leak value with a hypothetical attack path with stated assumptions, but external requirements
3: Funds can be stolen/lost directly, or indirectly if a valid attack path shown that does not have handwavey hypotheticals.
Recommended: 0

dmvt (judge) commented:

This is reasonably easy to mitigate as an issue and failure to do so does leave an attack vector open. If exploited it will result in a loss of user funds.



