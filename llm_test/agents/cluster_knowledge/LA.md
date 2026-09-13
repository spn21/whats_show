## [H-01]  "Signature malleability of EVM’s ecrecover in verify()"

EVM's ecrecover is susceptible to signature malleability, which allows replay attacks, but that is mitigated here by tracking accepted offers and canceling them (on L645) specifically to prevent replays. However, if any application logic changes, it might make signature malleability a risk for replay attacks.
See reference.
Recommend using OpenZeppelin's ECDSA library


## [H-02]  "Arbitrary Transfer of Unowned NFTs"

Due to how the market functions are structured, it is possible to arbitrarily transfer any NFT that is not owned by any address.
The function in question is the tradeValid function invoked by acceptTrade before the trade is performed. It, in turn, validates the signature of a trade via verify, which does not account for the behavior of ecrecover.
When ecrecover is invoked with an invalid signature, the zero-address is returned by it, meaning that verify will yield true for the zero-address as long as the signature provided is invalid.
This can be exploited to transfer any NFT whose idToOwner is zero, including NFTs that have not been minted yet.
Recommend an additional check be imposed within verify that ensures the signer is not the zero-address which will alleviate this check. For more details, consult the EIP721 implementation by OpenZeppelin.


## [H-01]  "Prevent execution with invalid signatures"

Submitted by gpersoon
Impact
Suppose one of the supplied addrs\[i] to the constructor of Identity.sol happens to be 0 ( by accident).
In that case: privileges\[0] = 1
Now suppose you call execute() with an invalid signature, then recoverAddrImpl will return a value of 0 and thus signer=0.
If you then check "privileges\[signer] !=0"  this will be true and anyone can perform any transaction.
This is clearly an unwanted situation.
Proof of Concept

Identity.sol#L23 L30
Identity.sol#L97 L98

Recommended Mitigation Steps
In the constructor of Identity.sol, add in the for loop the following:
solidity
require (addrs\[i] !=0,"Zero not allowed");
Ivshti (Ambire) confirmed:
Ivshti (Ambire) patched:

resolved in https://github.com/AmbireTech/adex-protocol-eth/commit/08d050676773fcdf7ec1c4eb53d51820b7e42534

GalloDaSballo (judge) commented:

This seems to be the risk of having erecover returning zero, any invalid signature ends up being usable from any address to execute arbitrary logic.
Mitigation can be achieved by either reverting when about to return address(0), which the sponsor has used for mitigation
The other mitigation is to ensure that an account with address(0) cannot have privileges set to 1
I believe mitigation from sponsor to be sufficient, however I'd recommend adding a check against having address(0) in the constructor for Identity.sol just to be sure


Ivshti (Ambire) commented:

@GalloDeSballo an extra check is superfluous IMO, not only cause the revert on 0 in SIgnatureValidatorV2 guarantees that this is fixed, but also because it has to be in three places: constructor, setAddrPrivilege and the account creation system in js/IdentityProxyDeploy which rolls out bytecode that sstores privileges directly



## [H-04]  "return value of 0 from ecrecover not checked"

Submitted by gpersoon, also found by 0xRajeev, cmichel, and nikitastupin.
Impact
The solidity function ecrecover is used, however the error result of 0 is not checked for.
See documentation:
https://docs.soliditylang.org/en/v0.8.9/units-and-global-variables.html?highlight=ecrecover#mathematical-and-cryptographic-functions
"recover the address associated with the public key from elliptic curve signature or return zero on error. "
Now you can supply invalid input parameters to the Sig.recover function, which will then result 0.
If you also set o.maker to be 0 then this will match and an invalid signature is not detected.
So you can do all kinds of illegal & unexpected transactions.
Proof of Concept
https://github.com/Swivel-Finance/gost/blob/v2/test/swivel/Swivel.sol#L476-L484
solidity
  function validOrderHash(Hash.Order calldata o, Sig.Components calldata c) internal view returns (bytes32) {
  ...
  require(o.maker == Sig.recover(Hash.message(domain, hash), c), 'invalid signature');
  return hash;
  }
https://github.com/Swivel-Finance/gost/blob/v2/test/swivel/Sig.sol#L16-L23
solidity
  function recover(bytes32 h, Components calldata c) internal pure returns (address) {
  ...
  return ecrecover(h, c.v, c.r, c.s);
Tools Used
Recommended Mitigation Steps
Verify that the result from ecrecover isn't 0
JTraversa (Swivel) acknowledged
JTraversa (Swivel) commented:

Id say this is noteable, but because all actions require approvals from o.maker, having 0x00 as o.maker with an "invalid" but valid signature should not be impactful.
The suggestion would be to filter 0x00 makers from the orderbook? (which we do)

Medium Risk Findings (5)


