import * as assert from "assert";
import React, { useContext, useState, useEffect } from "react";
import { useAsync } from "react-async-hook";
import { PublicKey } from "@solana/web3.js";
import {
  Token,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Market } from "@project-serum/serum";
import {
  SRM_MINT,
  USDC_MINT,
  USDT_MINT,
  SOL_MINT,
  WRAPPED_SOL_MINT,
  SOLLET_USDT_MINT,
  SOLLET_USDC_MINT,
} from "../utils/pubkeys";
import {
  useFairRoute,
  useRouteVerbose,
  useDexContext,
  FEE_MULTIPLIER,
  useBbo,
} from "./Dex";
import {
  useTokenListContext,
  SPL_REGISTRY_SOLLET_TAG,
  SPL_REGISTRY_WORM_TAG,
  useTokenMap,
} from "./TokenList";
import { useOwnedTokenAccount } from "../context/Token";

const DEFAULT_SLIPPAGE_PERCENT = 0.5;

export type SwapContext = {
  // Mint being traded from. The user must own these tokens.
  fromMint: PublicKey;
  setFromMint: (m: PublicKey) => void;

  // Mint being traded to. The user will receive these tokens after the swap.
  toMint: PublicKey;
  setToMint: (m: PublicKey) => void;

  // Amount used for the swap.
  fromAmount: number;
  setFromAmount: (a: number) => void;

  // *Expected* amount received from the swap.
  toAmount: number;
  setToAmount: (a: number) => void;

  // Function to flip what we consider to be the "to" and "from" mints.
  swapToFromMints: () => void;

  // The amount (in units of percent) a swap can be off from the estimate
  // shown to the user.
  slippage: number;
  setSlippage: (n: number) => void;

  // Null if the user is using fairs directly from DEX prices.
  // Otherwise, a user specified override for the price to use when calculating
  // swap amounts.
  fairOverride: number | null;
  setFairOverride: (n: number | null) => void;

  // The referral *owner* address. Associated token accounts must be created,
  // first, for this to be used.
  referral?: PublicKey;

  // True if all newly created market accounts should be closed in the
  // same user flow (ideally in the same transaction).
  isClosingNewAccounts: boolean;

  // True if the swap exchange rate should be a function of nothing but the
  // from and to tokens, ignoring any quote tokens that may have been
  // accumulated by performing the swap.
  //
  // Always false (for now).
  isStrict: boolean;
  setIsStrict: (isStrict: boolean) => void;

  setIsClosingNewAccounts: (b: boolean) => void;

  // A button state to reverse denominator of prices. Eg. if swap show
  // price of SOL/USDC, then show USDC/SOL price when reverse is true.
  showReversePrices: boolean;
  setShowReversePrices: (
    b: boolean | ((prevState: boolean) => boolean)
  ) => void;
};
const _SwapContext = React.createContext<null | SwapContext>(null);

export function SwapContextProvider(props: any) {
  const [fromMint, setFromMint] = useState(props.fromMint ?? SRM_MINT);
  const [toMint, setToMint] = useState(props.toMint ?? USDC_MINT);
  const [fromAmount, _setFromAmount] = useState(props.fromAmount ?? 0);
  const [toAmount, _setToAmount] = useState(props.toAmount ?? 0);
  const [showReversePrices, setShowReversePrices] = useState(false);
  const [isClosingNewAccounts, setIsClosingNewAccounts] = useState(false);
  const [isStrict, setIsStrict] = useState(false);
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE_PERCENT);
  const [fairOverride, setFairOverride] = useState<number | null>(null);
  const { isWrapUnwrap } = useIsWrapSol(fromMint, toMint);
  const fair = _useSwapFair(fromMint, toMint, fairOverride);
  const referral = props.referral;
  const feeMultiplier = isWrapUnwrap ? 1 : FEE_MULTIPLIER;

  assert.ok(slippage >= 0);

  useEffect(() => {
    if (!fair) {
      return;
    }
    setFromAmount(fromAmount);
  }, [fair]);

  const swapToFromMints = () => {
    const oldFrom = fromMint;
    const oldTo = toMint;
    const oldToAmount = toAmount;
    _setFromAmount(oldToAmount);
    setFromMint(oldTo);
    setToMint(oldFrom);
  };

  const setFromAmount = (amount: number) => {
    if (fair === undefined) {
      _setFromAmount(0);
      _setToAmount(0);
      return;
    }
    _setFromAmount(amount);
    _setToAmount(feeMultiplier * (amount / fair));
  };

  const setToAmount = (amount: number) => {
    if (fair === undefined) {
      _setFromAmount(0);
      _setToAmount(0);
      return;
    }
    _setToAmount(amount);
    _setFromAmount((amount * fair) / FEE_MULTIPLIER);
  };

  return (
    <_SwapContext.Provider
      value={{
        fromMint,
        setFromMint,
        toMint,
        setToMint,
        fromAmount,
        setFromAmount,
        toAmount,
        setToAmount,
        swapToFromMints,
        slippage,
        setSlippage,
        fairOverride,
        setFairOverride,
        isClosingNewAccounts,
        isStrict,
        setIsStrict,
        setIsClosingNewAccounts,
        referral,
        showReversePrices,
        setShowReversePrices,
      }}
    >
      {props.children}
    </_SwapContext.Provider>
  );
}

export function useSwapContext(): SwapContext {
  const ctx = useContext(_SwapContext);
  if (ctx === null) {
    throw new Error("Context not available");
  }
  return ctx;
}

export function useSwapFair(): number | undefined {
  const { fairOverride, fromMint, toMint } = useSwapContext();
  return _useSwapFair(fromMint, toMint, fairOverride);
}

// get reverse price for pair  (diff fn to prevent side-effects)
export function getSwapFair(reversed: boolean = false): number | undefined {
  const { fairOverride, fromMint, toMint } = useSwapContext();
  return reversed
    ? _useSwapFair(toMint, fromMint, fairOverride)
    : _useSwapFair(fromMint, toMint, fairOverride);
}

function _useSwapFair(
  fromMint: PublicKey,
  toMint: PublicKey,
  fairOverride: number | null
): number | undefined {
  const { isWrapUnwrap } = useIsWrapSol(fromMint, toMint);
  const fairRoute = useFairRoute(fromMint, toMint);
  const fair = fairOverride === null ? fairRoute : fairOverride;

  if (isWrapUnwrap) {
    return 1;
  }
  return fair;
}

export function useIsWrapSol(
  fromMint: PublicKey,
  toMint: PublicKey
): {
  isWrapSol: boolean;
  isUnwrapSol: boolean;
  isWrapUnwrap: boolean;
} {
  const isWrapSol =
    fromMint.equals(SOL_MINT) && toMint.equals(WRAPPED_SOL_MINT);
  const isUnwrapSol =
    fromMint.equals(WRAPPED_SOL_MINT) && toMint.equals(SOL_MINT);
  const isWrapUnwrap = isWrapSol || isUnwrapSol;
  return {
    isWrapSol,
    isUnwrapSol,
    isWrapUnwrap,
  };
}

// Returns true if the user can create accounts with the current context.
export function useCanCreateAccounts(): boolean {
  const { fromMint, toMint } = useSwapContext();
  const { swapClient } = useDexContext();
  const { wormholeMap, solletMap } = useTokenListContext();
  const fromWallet = useOwnedTokenAccount(fromMint);
  const fair = useSwapFair();
  const route = useRouteVerbose(fromMint, toMint);

  if (route === null) {
    return false;
  }

  return (
    // From wallet exists.
    fromWallet !== undefined &&
    fromWallet !== null &&
    // Fair price is defined.
    fair !== undefined &&
    fair > 0 &&
    // Mints are distinct.
    fromMint.equals(toMint) === false &&
    // Wallet is connected.
    swapClient.program.provider.wallet.publicKey !== null &&
    // Trade route exists.
    route !== null &&
    // Wormhole <-> native markets must have the wormhole token as the
    // *from* address since they're one-sided markets.
    (route.kind !== "wormhole-native" ||
      wormholeMap
        .get(fromMint.toString())
        ?.tags?.includes(SPL_REGISTRY_WORM_TAG) !== undefined) &&
    // Wormhole <-> sollet markets must have the sollet token as the
    // *from* address since they're one sided markets.
    (route.kind !== "wormhole-sollet" ||
      solletMap
        .get(fromMint.toString())
        ?.tags?.includes(SPL_REGISTRY_SOLLET_TAG) !== undefined)
  );
}

export function useCanWrapOrUnwrap(): boolean {
  const { fromMint, fromAmount, toAmount } = useSwapContext();
  const { swapClient } = useDexContext();
  const fromWallet = useOwnedTokenAccount(fromMint);

  return (
    // From wallet exists.
    fromWallet !== undefined &&
    fromWallet !== null &&
    // Wallet is connected.
    swapClient.program.provider.wallet.publicKey !== null &&
    // Trade amounts greater than zero.
    fromAmount > 0 &&
    toAmount > 0
  );
}

export function useIsUnwrapSollet(
  fromMint: PublicKey,
  toMint: PublicKey
): boolean {
  return (
    (fromMint.equals(SOLLET_USDT_MINT) && toMint.equals(USDT_MINT)) ||
    (fromMint.equals(SOLLET_USDC_MINT) && toMint.equals(USDC_MINT))
  );
}

function getMinSwapMessage(minAmount: number, symbol: string) {
  if (symbol === "wSOL") {
    symbol = "SOL";
  }
  return minAmount + " " + symbol;
}

// Return string message if trade amount is below minimum swap amount
export function useMinSwapAmount(fromMarket?: Market, toMarket?: Market) {
  const { fromMint, fromAmount, toAmount } = useSwapContext();
  const fromMarketBbo = useBbo(fromMarket?.publicKey);
  const toMarketMidBbo = useBbo(toMarket?.publicKey);
  const tokenMap = useTokenMap();

  if (!fromMarket) {
    return undefined;
  }
  const fromMarketIsBid = fromMarket.quoteMintAddress.equals(fromMint);
  const fromMarketMinSize = fromMarket.minOrderSize;
  const fromMarketBaseAmount = fromMarketIsBid ? toAmount : fromAmount;
  const belowFromMarketMinSize = fromMarketBaseAmount < fromMarketMinSize;

  if (!toMarket && belowFromMarketMinSize) {
    let tokenSymbol =
      tokenMap.get(fromMarket!.baseMintAddress.toString())?.symbol ?? "unknown";
    return getMinSwapMessage(fromMarketMinSize, tokenSymbol);
  } else if (toMarket) {
    const toMarketMinSize = toMarket.minOrderSize;
    const belowToMarketMinSize = toAmount < toMarketMinSize;
    if (belowToMarketMinSize || belowFromMarketMinSize) {
      const fromTokenWorth = fromMarketMinSize * (fromMarketBbo?.bestBid ?? 0);
      const toTokenWorth = toMarketMinSize * (toMarketMidBbo?.bestBid ?? 0);
      const higherMinSizeWorthMarket =
        fromTokenWorth > toTokenWorth ? fromMarket : toMarket;
      const tokenSymbol =
        tokenMap.get(higherMinSizeWorthMarket!.baseMintAddress.toString())
          ?.symbol ?? "unknown";

      return getMinSwapMessage(
        higherMinSizeWorthMarket.minOrderSize,
        tokenSymbol
      );
    }
  }
}

// Returns true if the user can swap with the current context.
export function useCanSwap(): boolean {
  const { fromMint, toMint, fromAmount, toAmount } = useSwapContext();
  const { swapClient } = useDexContext();
  const { wormholeMap, solletMap } = useTokenListContext();
  const fromWallet = useOwnedTokenAccount(fromMint);
  const fair = useSwapFair();
  const route = useRouteVerbose(fromMint, toMint);

  if (route === null) {
    return false;
  }

  return (
    // From wallet exists.
    fromWallet !== undefined &&
    fromWallet !== null &&
    // Fair price is defined.
    fair !== undefined &&
    fair > 0 &&
    // Mints are distinct.
    fromMint.equals(toMint) === false &&
    // Wallet is connected.
    swapClient.program.provider.wallet.publicKey !== null &&
    // Trade amounts greater than zero.
    fromAmount > 0 &&
    toAmount > 0 &&
    // Trade route exists.
    route !== null &&
    // Wormhole <-> native markets must have the wormhole token as the
    // *from* address since they're one-sided markets.
    (route.kind !== "wormhole-native" ||
      wormholeMap
        .get(fromMint.toString())
        ?.tags?.includes(SPL_REGISTRY_WORM_TAG) !== undefined) &&
    // Wormhole <-> sollet markets must have the sollet token as the
    // *from* address since they're one sided markets.
    (route.kind !== "wormhole-sollet" ||
      solletMap
        .get(fromMint.toString())
        ?.tags?.includes(SPL_REGISTRY_SOLLET_TAG) !== undefined)
  );
}

export function useReferral(fromMarket?: Market): PublicKey | undefined {
  const { referral } = useSwapContext();
  const asyncReferral = useAsync(async () => {
    if (!referral) {
      return undefined;
    }
    if (!fromMarket) {
      return undefined;
    }
    if (
      !fromMarket.quoteMintAddress.equals(USDC_MINT) &&
      !fromMarket.quoteMintAddress.equals(USDT_MINT)
    ) {
      return undefined;
    }

    return Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      fromMarket.quoteMintAddress,
      referral
    );
  }, [fromMarket]);

  if (!asyncReferral.result) {
    return undefined;
  }
  return asyncReferral.result;
}
