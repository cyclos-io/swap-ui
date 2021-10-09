import React, { useContext, useState, useEffect } from "react";
import * as assert from "assert";
import { useAsync } from "react-async-hook";
import { TokenInfo } from "@solana/spl-token-registry";
import { MintLayout } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
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
import { Actions, useMap } from "usehooks-ts";
import { useTokenContext } from "./Token";

const BASE_TAKER_FEE_BPS = 0.0022;
export const FEE_MULTIPLIER = 1 - BASE_TAKER_FEE_BPS;

// Get OpenOrders public key for swap instructions
// Callback functions to add and close open order accounts
type DexContext = {
  // Maps market address to open orders accounts.
  // openOrders: Map<string, Array<OpenOrders>>; // only public key is read
  closeOpenOrders: (openOrder: OpenOrders) => void;
  addOpenOrderAccount: (market: PublicKey, accountData: OpenOrders) => void;
  swapClient: SwapClient;
  // isLoaded: boolean;

  openOrders: Omit<Map<string, OpenOrders[]>, "set" | "clear" | "delete">;
  openOrdersActions: Actions<string, OpenOrders[]>;
};
export const _DexContext = React.createContext<DexContext | null>(null);

export function DexContextProvider(props: any) {
  // TODO save single account per market
  // OpenOrdersDialog needs bulk data, others need market wise

  const [openOrders, openOrdersActions] = useMap<string, Array<OpenOrders>>(new Map())
  
  // const [openOrders, setOpenOrders] = useState<Map<string, Array<OpenOrders>>>(
  //   new Map()
  // );
  // const [isLoaded, setIsLoaded] = useState(false);
  const swapClient = props.swapClient;

  // Removes the given open orders from the context.
  const closeOpenOrders = async (openOrder: OpenOrders) => {

    // const openOrderMarket = openOrder.market.toString()

    // const newOoAccounts = new Map(openOrders);

    // // Filter out, otherwise delete
    // const filteredOpenOrders = newOoAccounts
    //   .get(openOrderMarket)
    //   ?.filter((oo: OpenOrders) => !oo.address.equals(openOrder.address));
    // if (filteredOpenOrders && filteredOpenOrders.length > 0) {
    //   newOoAccounts.set(openOrderMarket, filteredOpenOrders);
    // } else {
    //   newOoAccounts.delete(openOrderMarket);
    // }
    // setOpenOrders(newOoAccounts);
  };

  const addOpenOrderAccount = async (
    market: PublicKey,
    accountData: OpenOrders
  ) => {
    // const newOoAccounts = new Map(openOrders);
    // newOoAccounts.set(market.toString(), [accountData]);
    // setOpenOrders(newOoAccounts);
    // setIsLoaded(true);
  };

  // Three operations:
  //
  // 1. Fetch and store all open orders accounts for the connected wallet.
  // 2. Batch fetch and store all market accounts for those open orders.
  // 3. Batch fetch all mints associated with the markets. Read decimal places for storing in
  // market account state.
  // useEffect(() => {
  //   if (!swapClient.program.provider.wallet.publicKey) {
  //     setOpenOrders(new Map());
  //     return;
  //   }
  //   OpenOrders.findForOwner(
  //     swapClient.program.provider.connection,
  //     swapClient.program.provider.wallet.publicKey,
  //     DEX_PID
  //   ).then(async (openOrders) => {
  //     // Find all open order accounts for wallet
  //     const newOoAccounts = new Map<string, Array<OpenOrders>>();

  //     // Markets for which user has OpenOrder accounts
  //     const userMarkets = new Set<string>();

  //     openOrders.forEach((oo) => {
  //       const ooMarket = oo.market.toString()
  //       userMarkets.add(ooMarket);
  //       const savedOoForMarket = newOoAccounts.get(ooMarket)
  //       if (savedOoForMarket) {
  //         savedOoForMarket.push(oo);
  //       } else {
  //         newOoAccounts.set(ooMarket, [oo]);
  //       }
  //     });
  //     if (userMarkets.size > 100) {
  //       // Punt request chunking until there's user demand.
  //       throw new Error(
  //         "Too many markets. Please file an issue to update this"
  //       );
  //     }
  //     // Fetch account info for each user market
  //     const multipleMarkets = await anchor.utils.rpc.getMultipleAccounts(
  //       swapClient.program.provider.connection,
  //       Array.from(userMarkets.values()).map((m) => new PublicKey(m))
  //     );

  //     // Decode market account info
  //     const marketClients = multipleMarkets.map((programAccount) => {
  //       return {
  //         publicKey: programAccount?.publicKey,
  //         account: new Market(
  //           Market.getLayout(DEX_PID).decode(programAccount?.account.data),
  //           // base and quote mint decimals fetched later
  //           -1, // Set below so that we can batch fetch mints.
  //           -1, // Set below so that we can batch fetch mints.
  //           swapClient.program.provider.opts,
  //           DEX_PID
  //         ),
  //       };
  //     });

  //     setOpenOrders(newOoAccounts);

  //     // Batch fetch all the mints, since we know we'll need them at some
  //     // point.
  //     const mintPubkeys = Array.from(
  //       new Set<string>(
  //         marketClients
  //           .map((m) => [
  //             m.account.baseMintAddress.toString(),
  //             m.account.quoteMintAddress.toString(),
  //           ])
  //           .flat()
  //       ).values()
  //     ).map((pk) => new PublicKey(pk));

  //     if (mintPubkeys.length > 100) {
  //       // Punt request chunking until there's user demand.
  //       throw new Error("Too many mints. Please file an issue to update this");
  //     }

  //     // Reads mint account infos and decode them
  //     const mints = await anchor.utils.rpc.getMultipleAccounts(
  //       swapClient.program.provider.connection,
  //       mintPubkeys
  //     );
  //     const mintInfos = mints.map((mint) => {
  //       const mintInfo = MintLayout.decode(mint!.account.data);
  //       // setMintCache(mint!.publicKey, mintInfo);
  //       return { publicKey: mint!.publicKey, mintInfo };
  //     });

  //     // Set decimal places for each market's token accounts, then save in cache
  //     marketClients.forEach((marketClient) => {
  //       const baseMintInfo = mintInfos.filter((mint) =>
  //         mint.publicKey.equals(marketClient.account.baseMintAddress)
  //       )[0];
  //       const quoteMintInfo = mintInfos.filter((mint) =>
  //         mint.publicKey.equals(marketClient.account.quoteMintAddress)
  //       )[0];
  //       assert.ok(baseMintInfo && quoteMintInfo);
  //       // @ts-ignore
  //       marketClient.account._baseSplTokenDecimals = baseMintInfo.mintInfo.decimals;
  //       // @ts-ignore
  //       marketClient.account._quoteSplTokenDecimals = quoteMintInfo.mintInfo.decimals;
  //       _MARKET_CACHE.set(
  //         marketClient.publicKey!.toString(),
  //         new Promise<Market>((resolve) => resolve(marketClient.account))
  //       );
  //     });

  //     setIsLoaded(true);
  //   });
  // }, [
  //   swapClient.program.provider.connection,
  //   swapClient.program.provider.wallet.publicKey,
  //   swapClient.program.provider.opts,
  // ]);

  return (
    <_DexContext.Provider
      value={{
        // openOrders,
        closeOpenOrders,
        addOpenOrderAccount,
        swapClient,
        // isLoaded,
        openOrders,
        openOrdersActions
      }}
    >
      {props.children}
    </_DexContext.Provider>
  );
}

/**
 * Return all OpenOrder accounts of a user for a given market
 */
export function useOpenOrderAccounts(market?: Market) {
  const { provider } = useTokenContext()
  const { openOrders, openOrdersActions } = useDexContext()

  const response = useAsync(async () => {
    if (!market) {
      return undefined
    }
    const marketKey = market.address.toString()
    const savedOpenOrders = openOrders.get(marketKey)
    if (savedOpenOrders) {
      console.log('Returning saved')
      return savedOpenOrders
    }
    // Fetch if not saved in cache
    const fetchedOpenOrders = await market.findOpenOrdersAccountsForOwner(
      provider.connection,
      provider.wallet.publicKey
    )
    // Triggers rerender, where saved value will be returned
    openOrdersActions.set(marketKey, fetchedOpenOrders)
    return fetchedOpenOrders
  }, [market])

  return response
}

export function useDexContext(): DexContext {
  const ctx = useContext(_DexContext);
  if (ctx === null) {
    throw new Error("Context not available");
  }
  return ctx;
}

// Lazy load a given market. Used to
// - Read base and quote token mint addresses
// - Market address
// - Call makeSettleFundsTransaction(), loadBids(), loadAsks()
// New update- return from cache if present, otherwise fetch
export function useMarket(market?: PublicKey): Market | undefined {
  const { swapClient } = useDexContext();

  const asyncMarket = useAsync(async () => {
    if (!market) {
      return undefined;
    }
    // Markets are eager loaded. Check if already stored
    const savedMarket = _MARKET_CACHE.get(market.toString())
    if (savedMarket) {
      return savedMarket;
    }

    const marketClient = new Promise<Market>(async (resolve) => {
      // TODO: if we already have the mints, then pass them through to the
      //       market client here to save a network request.
      const marketClient = await Market.load(
        swapClient.program.provider.connection,
        market,
        swapClient.program.provider.opts,
        DEX_PID
      );
      resolve(marketClient);
    });

    _MARKET_CACHE.set(market.toString(), marketClient);
    return marketClient;
  }, [swapClient.program.provider.connection, market]);

  if (asyncMarket.result) {
    return asyncMarket.result;
  }

  return undefined;
}

// Lazy load the bids and slabs for a given market.
// Used to find price impact and bbo
export function useMarketSlabs(market?: PublicKey): Slabs | undefined {
  const { swapClient } = useDexContext();
  const marketClient = useMarket(market);
  const [refresh, setRefresh] = useState(0);

  const asyncOrderbook = useAsync(async () => {
    if (!market || !marketClient) {
      return undefined;
    }
    if (_SLAB_CACHE.get(market.toString())) {
      return _SLAB_CACHE.get(market.toString());
    }

    const orderbook = new Promise<Slabs>(async (resolve) => {
      const [bids, asks] = await Promise.all([
        marketClient.loadBids(swapClient.program.provider.connection),
        marketClient.loadAsks(swapClient.program.provider.connection),
      ]);

      resolve({
        bids,
        asks,
      });
    });

    _SLAB_CACHE.set(market.toString(), orderbook);

    return orderbook;
  }, [refresh, swapClient.program.provider.connection, market, marketClient]);

  // Stream in bids updates.
  useEffect(() => {
    let listener: number | undefined;
    if (marketClient?.bidsAddress) {
      listener = swapClient.program.provider.connection.onAccountChange(
        marketClient?.bidsAddress,
        async (info) => {
          const bids = OrderbookSide.decode(marketClient, info.data);
          const orderbook = await _SLAB_CACHE.get(
            marketClient.address.toString()
          );
          const oldBestBid = orderbook?.bids.items(true).next().value;
          const newBestBid = bids.items(true).next().value;
          if (
            orderbook &&
            oldBestBid &&
            newBestBid &&
            oldBestBid.price !== newBestBid.price
          ) {
            orderbook.bids = bids;
            setRefresh((r) => r + 1);
          }
        }
      );
    }
    return () => {
      if (listener) {
        swapClient.program.provider.connection.removeAccountChangeListener(
          listener
        );
      }
    };
  }, [
    marketClient,
    marketClient?.bidsAddress,
    swapClient.program.provider.connection,
  ]);

  // Stream in asks updates.
  useEffect(() => {
    let listener: number | undefined;
    if (marketClient?.asksAddress) {
      listener = swapClient.program.provider.connection.onAccountChange(
        marketClient?.asksAddress,
        async (info) => {
          const asks = OrderbookSide.decode(marketClient, info.data);
          const orderbook = await _SLAB_CACHE.get(
            marketClient.address.toString()
          );
          const oldBestOffer = orderbook?.asks.items(false).next().value;
          const newBestOffer = asks.items(false).next().value;
          if (
            orderbook &&
            oldBestOffer &&
            newBestOffer &&
            oldBestOffer.price !== newBestOffer.price
          ) {
            orderbook.asks = asks;
            setRefresh((r) => r + 1);
          }
        }
      );
    }
    return () => {
      if (listener) {
        swapClient.program.provider.connection.removeAccountChangeListener(
          listener
        );
      }
    };
  }, [
    marketClient,
    marketClient?.bidsAddress,
    swapClient.program.provider.connection,
  ]);

  if (asyncOrderbook.result) {
    return asyncOrderbook.result;
  }

  return undefined;
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
  const route = useRoute(fromMint, toMint);
  const fromBbo = useBbo(route ? route[0] : undefined);
  const fromMarket = useMarket(route ? route[0] : undefined);
  const toBbo = useBbo(route ? route[1] : undefined);
  const { isWrapUnwrap } = useIsWrapSol(fromMint, toMint);

  if (isWrapUnwrap) {
    return undefined;
  }

  if (route === null) {
    return undefined;
  }

  if (route.length === 1 && fromBbo !== undefined) {
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

export function useRoute(
  fromMint: PublicKey,
  toMint: PublicKey
): Array<PublicKey> | null {
  const route = useRouteVerbose(fromMint, toMint);
  if (route === null) {
    return null;
  }
  return route.markets;
}

// Types of routes.
//
// 1. Direct trades on USDC quoted markets.
// 2. Transitive trades across two USDC qutoed markets.
// 3. Wormhole <-> Sollet one-to-one swap markets.
// 4. Wormhole <-> Native one-to-one swap markets.
//
export function useRouteVerbose(
  fromMint: PublicKey,
  toMint: PublicKey
): { markets: Array<PublicKey>; kind: RouteKind } | null {
  const { swapClient } = useDexContext();
  const { wormholeMap, solletMap } = useTokenListContext();
  const asyncRoute = useAsync(async () => {
    const swapMarket = await wormholeSwapMarket(
      swapClient.program.provider.connection,
      fromMint,
      toMint,
      wormholeMap,
      solletMap
    );
    if (swapMarket !== null) {
      const [wormholeMarket, kind] = swapMarket;
      return { markets: [wormholeMarket], kind };
    }
    const markets = swapClient.route(
      fromMint.equals(SOL_MINT) ? WRAPPED_SOL_MINT : fromMint,
      toMint.equals(SOL_MINT) ? WRAPPED_SOL_MINT : toMint
    );
    if (markets === null) {
      return null;
    }
    const kind: RouteKind = "usdx";
    return { markets, kind };
  }, [fromMint, toMint, swapClient]);

  if (asyncRoute.result) {
    return asyncRoute.result;
  }
  return null;
}

type Slabs = {
  bids: OrderbookSide;
  asks: OrderbookSide;
};

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

// To find price impact and BBO
const _SLAB_CACHE = new Map<string, Promise<Slabs>>();

const _MARKET_CACHE = new Map<string, Promise<Market>>();

