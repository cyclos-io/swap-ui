import React, { useContext, useState, ReactNode, useEffect } from "react";
import { TokenInfo } from "@solana/spl-token-registry";
import { Connection, PublicKey } from "@solana/web3.js";
import { Swap as SwapClient } from "@project-serum/swap";
import {
  Market,
  OpenOrders,
  Orderbook as OrderbookSide,
} from "@project-serum/serum";
import {
  DEX_PID,
  USDC_MINT,
  USDT_MINT,
  SOL_MINT,
  WRAPPED_SOL_MINT,
  WORM_USDC_MINT,
  WORM_USDT_MINT,
  WORM_USDC_MARKET,
  WORM_USDT_MARKET,
  WORM_MARKET_BASE,
} from "../utils/pubkeys";
import { useTokenListContext, useTokenInfo } from "./TokenList";
import { fetchSolletInfo, requestWormholeSwapMarketIfNeeded } from "./Sollet";
import { useSwapContext, useIsWrapSol } from "./Swap";
import { Actions, useInterval, useMap } from "usehooks-ts";

const BASE_TAKER_FEE_BPS = 0.0022;
export const FEE_MULTIPLIER = 1 - BASE_TAKER_FEE_BPS;

export type Slabs = {
  bids: OrderbookSide;
  asks: OrderbookSide;
};

type DexContext = {
  addOpenOrderAccount: (market: PublicKey, accountData: OpenOrders) => void;
  swapClient: SwapClient;
  openOrders: Omit<Map<string, OpenOrders[]>, "set" | "clear" | "delete">;
  openOrdersActions: Actions<string, OpenOrders[]>;
  markets: Omit<Map<string, Market>, "set" | "clear" | "delete">;
  marketsActions: Actions<string, Market>;
  slabMap: Omit<Map<string, Slabs>, "set" | "clear" | "delete">;
  slabMapActions: Actions<string, Slabs>;
  route: Route | undefined;
  updateRoute: (fromMint: PublicKey, toMint: PublicKey) => Promise<void>;
};
export const _DexContext = React.createContext<DexContext | null>(null);

type DexContextProviderProps = {
  swapClient: SwapClient;
  children: ReactNode;
};

export type Route = {
  markets: PublicKey[];
  kind: RouteKind;
};

export function DexContextProvider(props: DexContextProviderProps) {
  const { wormholeMap, solletMap } = useTokenListContext();
  const [route, setRoute] = useState<Route>();

  const [openOrders, openOrdersActions] = useMap<string, Array<OpenOrders>>(
    new Map()
  );
  const [markets, marketsActions] = useMap<string, Market>(new Map());
  const [slabMap, slabMapActions] = useMap<string, Slabs>(new Map());

  const swapClient = props.swapClient;
  const provider = swapClient.program.provider;

  // Fetch market data route changes
  useEffect(() => {
    async function setMarketsForRoute() {
      if (!route) {
        return;
      }
      for (const market of route?.markets) {
        const marketKey = market.toString();
        const savedMarket = markets.get(marketKey);
        if (!savedMarket) {
          try {
            const fetchedMarket = await Market.load(
              provider.connection,
              market,
              provider.opts,
              DEX_PID
            );
            marketsActions.set(marketKey, fetchedMarket);
          } catch(error) {
            console.log('Failed to fetch market', error)
          }

        }
      }
    }
    setMarketsForRoute();
  }, [route]);

  // Update OpenOrders when route or wallet changes
  const walletKey = provider.wallet.publicKey;
  useEffect(() => {
    async function setOpenOrdersForRoute() {
      if (!route) {
        return;
      }
      if (!walletKey) {
        if (openOrders?.size !== 0) {
          openOrdersActions.reset();
        }
        return;
      }
      for (const market of route?.markets) {
        const marketKey = market.toString();
        const savedOo = openOrders.get(marketKey);
        if (!savedOo) {
          const savedMarket = markets.get(marketKey);
          // exit if market client is not saved
          if (!savedMarket) {
            return;
          }

          try {
            const fetchedOpenOrders =
            await savedMarket.findOpenOrdersAccountsForOwner(
              provider.connection,
              walletKey
            );

          openOrdersActions.set(marketKey, fetchedOpenOrders);
          } catch(error) {
            console.error('Failed to get open order accounts', error)
          }

        }
      }
    }
    setOpenOrdersForRoute();
  }, [route, markets, walletKey]);

  const addOpenOrderAccount = (market: PublicKey, accountData: OpenOrders) => {
    openOrdersActions.set(market.toString(), [accountData]);
  };

  // Types of routes.
  //
  // 1. Direct trades on USDC quoted markets.
  // 2. Transitive trades across two USDC qutoed markets.
  // 3. Wormhole <-> Sollet one-to-one swap markets.
  // 4. Wormhole <-> Native one-to-one swap markets.
  //
  const updateRoute = async (fromMint: PublicKey, toMint: PublicKey) => {
    const swapMarket = await wormholeSwapMarket(
      provider.connection,
      fromMint,
      toMint,
      wormholeMap,
      solletMap
    );
    if (swapMarket) {
      const [wormholeMarket, kind] = swapMarket;
      setRoute({ markets: [wormholeMarket], kind });
    } else {
      // Look up token list to find usdx market route
      const markets = swapClient.route(
        fromMint.equals(SOL_MINT) ? WRAPPED_SOL_MINT : fromMint,
        toMint.equals(SOL_MINT) ? WRAPPED_SOL_MINT : toMint
      );
      // console.log("Got route markets", markets);

      if (markets) {
        const kind: RouteKind = "usdx";
        setRoute({ markets, kind });
      } else {
        setRoute(undefined);
      }
    }
  };

  // Poll for bid and ask slabs to display current price of token
  useInterval(
    async () => {
      if (!route) {
        return;
      }
      route.markets.forEach(async (market) => {
        const marketKey = market.toString();
        const marketClient = markets.get(marketKey);
        if (!marketClient) {
          return;
        }
        try {
          const bids = await marketClient.loadBids(provider.connection);
          const asks = await marketClient.loadAsks(provider.connection);
          slabMapActions.set(marketKey, { bids, asks });
        } catch(error) {
          console.error('Failed to poll for slabs', error)
        }

      });
    },
    route ? 10000 : null
  );

  return (
    <_DexContext.Provider
      value={{
        addOpenOrderAccount,
        swapClient,
        openOrders,
        openOrdersActions,
        markets,
        marketsActions,
        slabMap,
        slabMapActions,
        route,
        updateRoute,
      }}
    >
      {props.children}
    </_DexContext.Provider>
  );
}

export function useDexContext(): DexContext {
  const ctx = useContext(_DexContext);
  if (ctx === null) {
    throw new Error("Context not available");
  }
  return ctx;
}

/**
 * Return all OpenOrder accounts of a user for a given market
 */
export function useOpenOrderAccounts(market?: PublicKey) {
  const { openOrders } = useDexContext();
  return market ? openOrders.get(market.toString()) : undefined;
}

/**
 * Get saved Market client for given market public key
 * @param market public key
 * @returns Market | undefined
 */
export function useMarket(market?: PublicKey): Market | undefined {
  const { markets } = useDexContext();
  return market ? markets.get(market.toString()) : undefined;
}

/**
 * Get bid and ask slabs for the given market
 * Used to calculate BBO and price impact
 * @param market
 * @returns Slabs
 */
export function useMarketSlabs(market?: PublicKey): Slabs | undefined {
  const { slabMap } = useDexContext();
  return market ? slabMap.get(market?.toString()) : undefined;
}

export function useMarketName(market: PublicKey): string | null {
  const marketClient = useMarket(market);
  const baseTokenInfo = useTokenInfo(marketClient?.baseMintAddress);
  const quoteTokenInfo = useTokenInfo(marketClient?.baseMintAddress);

  if (!marketClient) {
    return null;
  }
  const baseTicker = baseTokenInfo?.symbol ?? "-";
  const quoteTicker = quoteTokenInfo?.symbol ?? "-";

  return `${baseTicker} / ${quoteTicker}`;
}

// TODO handle edge case of insufficient liquidity
export function usePriceImpact(market?: PublicKey): number | undefined {
  const { toAmount, toMint } = useSwapContext();
  const orderbook = useMarketSlabs(market);
  if (orderbook === undefined) {
    return undefined;
  }
  const orders = toMint.equals(orderbook.bids.market.baseMintAddress)
    ? orderbook.asks.items(false)
    : orderbook.bids.items(true);

  let remainingAmount = toAmount;
  let order = orders.next();
  const initialPrice = order.value.price;
  let priceAfterOrder = initialPrice;

  while (!order.done && remainingAmount > 0) {
    priceAfterOrder = order.value.price;
    remainingAmount =
      remainingAmount > order.value.size
        ? remainingAmount - order.value.size
        : 0;
    order = orders.next();
  }

  const priceChange = Math.abs(initialPrice - priceAfterOrder);
  const impact = (priceChange * 100) / initialPrice;
  return impact;
}
// Fair price for a given market, as defined by the mid.
export function useBbo(market?: PublicKey): Bbo | undefined {
  const orderbook = useMarketSlabs(market);
  if (orderbook === undefined) {
    return undefined;
  }
  const bestBid = orderbook.bids.items(true).next().value;
  const bestOffer = orderbook.asks.items(false).next().value;
  if (!bestBid && !bestOffer) {
    return {};
  }
  if (!bestBid) {
    return { bestOffer: bestOffer.price };
  }
  if (!bestOffer) {
    return { bestBid: bestBid.price };
  }
  const mid = (bestBid.price + bestOffer.price) / 2.0;
  return { bestBid: bestBid.price, bestOffer: bestOffer.price, mid };
}

// Fair price for a theoretical toMint/fromMint market. I.e., the number
// of `fromMint` tokens to purchase a single `toMint` token. Aggregates
// across a trade route, if needed.
export function useFairRoute(
  fromMint: PublicKey,
  toMint: PublicKey
): number | undefined {
  const { route } = useDexContext();
  const fromBbo = useBbo(route?.markets[0]);
  const fromMarket = useMarket(route?.markets[0]);
  const toBbo = useBbo(route?.markets[1]);
  const { isWrapUnwrap } = useIsWrapSol(fromMint, toMint);

  if (isWrapUnwrap) {
    return undefined;
  }

  if (!route) {
    return undefined;
  }

  if (route.markets.length === 1 && fromBbo !== undefined) {
    if (fromMarket === undefined) {
      return undefined;
    }
    if (
      fromMarket?.baseMintAddress.equals(fromMint) ||
      (fromMarket?.baseMintAddress.equals(WRAPPED_SOL_MINT) &&
        fromMint.equals(SOL_MINT))
    ) {
      return fromBbo.bestBid && 1.0 / fromBbo.bestBid;
    } else {
      return fromBbo.bestOffer && fromBbo.bestOffer;
    }
  }
  if (
    fromBbo === undefined ||
    fromBbo.bestBid === undefined ||
    toBbo === undefined ||
    toBbo.bestOffer === undefined
  ) {
    return undefined;
  }
  return toBbo.bestOffer / fromBbo.bestBid;
}

// Wormhole utils.

type RouteKind = "wormhole-native" | "wormhole-sollet" | "usdx";

// Maps fromMint || toMint (in sort order) to swap market public key.
// All markets for wormhole<->native tokens should be here, e.g.
// USDC <-> wUSDC.
const WORMHOLE_NATIVE_MAP = new Map<string, PublicKey>([
  [wormKey(WORM_USDC_MINT, USDC_MINT), WORM_USDC_MARKET],
  [wormKey(WORM_USDT_MINT, USDT_MINT), WORM_USDT_MARKET],
]);

function wormKey(fromMint: PublicKey, toMint: PublicKey): string {
  const [first, second] =
    fromMint < toMint ? [fromMint, toMint] : [toMint, fromMint];
  return first.toString() + second.toString();
}

async function wormholeSwapMarket(
  conn: Connection,
  fromMint: PublicKey,
  toMint: PublicKey,
  wormholeMap: Map<string, TokenInfo>,
  solletMap: Map<string, TokenInfo>
): Promise<[PublicKey, RouteKind] | null> {
  let market = wormholeNativeMarket(fromMint, toMint);
  if (market !== null) {
    return [market, "wormhole-native"];
  }
  market = await wormholeSolletMarket(
    conn,
    fromMint,
    toMint,
    wormholeMap,
    solletMap
  );
  if (market === null) {
    return null;
  }
  return [market, "wormhole-sollet"];
}

function wormholeNativeMarket(
  fromMint: PublicKey,
  toMint: PublicKey
): PublicKey | null {
  return WORMHOLE_NATIVE_MAP.get(wormKey(fromMint, toMint)) ?? null;
}

// Returns the market address of the 1-1 sollet<->wormhole swap market if it
// exists. Otherwise, returns null.
async function wormholeSolletMarket(
  conn: Connection,
  fromMint: PublicKey,
  toMint: PublicKey,
  wormholeMap: Map<string, TokenInfo>,
  solletMap: Map<string, TokenInfo>
): Promise<PublicKey | null> {
  const fromWormhole = wormholeMap.get(fromMint.toString());
  const isFromWormhole = fromWormhole !== undefined;

  const toWormhole = wormholeMap.get(toMint.toString());
  const isToWormhole = toWormhole !== undefined;

  const fromSollet = solletMap.get(fromMint.toString());
  const isFromSollet = fromSollet !== undefined;

  const toSollet = solletMap.get(toMint.toString());
  const isToSollet = toSollet !== undefined;

  if ((isFromWormhole || isToWormhole) && isFromWormhole !== isToWormhole) {
    if ((isFromSollet || isToSollet) && isFromSollet !== isToSollet) {
      const base = isFromSollet ? fromMint : toMint;
      const [quote, wormholeInfo] = isFromWormhole
        ? [fromMint, fromWormhole]
        : [toMint, toWormhole];

      const solletInfo = await fetchSolletInfo(base);

      if (solletInfo.erc20Contract !== wormholeInfo!.extensions?.address) {
        return null;
      }

      const market = await deriveWormholeMarket(base, quote);
      if (market === null) {
        return null;
      }

      const marketExists = await requestWormholeSwapMarketIfNeeded(
        conn,
        base,
        quote,
        market,
        solletInfo
      );
      if (!marketExists) {
        return null;
      }

      return market;
    }
  }
  return null;
}

// Calculates the deterministic address for the sollet<->wormhole 1-1 swap
// market.
async function deriveWormholeMarket(
  baseMint: PublicKey,
  quoteMint: PublicKey,
  version = 0
): Promise<PublicKey | null> {
  if (version > 99) {
    console.log("Swap market version cannot be greater than 99");
    return null;
  }
  if (version < 0) {
    console.log("Version cannot be less than zero");
    return null;
  }

  const padToTwo = (n: number) => (n <= 99 ? `0${n}`.slice(-2) : n);
  const seed =
    baseMint.toString().slice(0, 15) +
    quoteMint.toString().slice(0, 15) +
    padToTwo(version);
  return await PublicKey.createWithSeed(WORM_MARKET_BASE, seed, DEX_PID);
}

type Bbo = {
  bestBid?: number;
  bestOffer?: number;
  mid?: number;
};
