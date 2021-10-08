import React, {
  useContext,
  useMemo,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { TokenInfo, TokenListContainer } from "@solana/spl-token-registry";
import { PublicKey } from "@solana/web3.js";
import { WRAPPED_SOL_MINT } from "@project-serum/serum/lib/token-instructions";
import { LocalStorage } from "../utils/localStorage";
import { SOL_MINT } from "../utils/pubkeys";
import { useTokenContext } from "./Token";
import { Provider } from "@project-serum/anchor";

interface TokenCommonBaseInfo extends TokenInfo {
  isCommonBase?: boolean;
}

type TokenListContext = {
  tokenMap: Map<string, TokenInfo>;
  wormholeMap: Map<string, TokenInfo>;
  solletMap: Map<string, TokenInfo>;
  swappableTokens: TokenInfo[];
  swappableTokensSollet: TokenInfo[];
  swappableTokensWormhole: TokenInfo[];
  tokenBase: TokenInfo[] | undefined;
  addNewBase: (token: TokenInfo) => void;
  removeBase: (token: TokenInfo) => void;
  tokenBaseMap: Map<string, TokenCommonBaseInfo>;
};
const _TokenListContext = React.createContext<null | TokenListContext>(null);

// Tag in the spl-token-registry for sollet wrapped tokens.
export const SPL_REGISTRY_SOLLET_TAG = "wrapped-sollet";

// Tag in the spl-token-registry for wormhole wrapped tokens.
export const SPL_REGISTRY_WORM_TAG = "wormhole";

const SOL_TOKEN_INFO = {
  chainId: 101,
  address: SOL_MINT.toString(),
  name: "Native SOL",
  decimals: 9,
  symbol: "SOL",
  logoURI:
    "https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/solana/info/logo.png",
  tags: [],
  extensions: {
    website: "https://solana.com/",
    serumV3Usdc: "9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLusDBzvT",
    serumV3Usdt: "HWHvQhFmJB3NUcu1aihKmrKegfVxBEHzwVX6yZCKEsi1",
    coingeckoId: "solana",
    waterfallbot: "https://t.me/SOLwaterfall",
  },
};

type Props = {
  tokenList: TokenListContainer;
  commonBases: PublicKey[] | undefined;
  provider: Provider;
  children: ReactNode;
};
export function TokenListContextProvider(props: Props) {
  const { userTokens } = useTokenContext();

  const tokenList = useMemo(() => {
    const list = props.tokenList
      .filterByClusterSlug("mainnet-beta")
      .getList()
      .map((t: TokenInfo) => {
        if (t.address === WRAPPED_SOL_MINT.toString()) {
          // @ts-ignore
          t.symbol = "wSOL";
        }
        return t;
      });
    // Manually add a fake SOL mint for the native token. The component is
    // opinionated in that it distinguishes between wrapped SOL and SOL.
    list.push(SOL_TOKEN_INFO);
    return list;
  }, [props.tokenList]);

  // Token map for quick lookup.
  const tokenMap = useMemo(() => {
    const tokenMap = new Map<string, TokenCommonBaseInfo>();
    tokenList.forEach((t: TokenInfo) => {
      tokenMap.set(t.address, t);
    });
    return tokenMap;
  }, [tokenList]);

  // Tokens with USD(x) quoted markets.
  const swappableTokens = useMemo(() => {
    const allTokens = tokenList.filter((t: TokenInfo) => {
      const isUsdxQuoted =
        t.extensions?.serumV3Usdt || t.extensions?.serumV3Usdc;
      return isUsdxQuoted;
    });

    // Owned tokens sorted by moneyary worth
    const ownedTokens = allTokens
      .filter((token) => {
        return userTokens?.[token.address] !== undefined;
      })
      .sort((a: TokenInfo, b: TokenInfo) => {
        const tokenA = userTokens?.[a.address];
        const aWorth = (tokenA?.tokenAmount ?? 0) * (tokenA?.priceUsdt ?? 0);
        const tokenB = userTokens?.[b.address];
        const bWorth = (tokenB?.tokenAmount ?? 0) * (tokenB?.priceUsdt ?? 0);

        return bWorth - aWorth;
      });
    // Not owned tokens in alphabetical order
    const notOwnedtokens = allTokens
      .filter((token) => {
        return userTokens?.[token.address] === undefined;
      })
      .sort((a: TokenInfo, b: TokenInfo) =>
        a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0
      );

    return ownedTokens.concat(notOwnedtokens);
  }, [tokenList, tokenMap, userTokens]);

  // Sollet wrapped tokens.
  const [swappableTokensSollet, solletMap] = useMemo(() => {
    const tokens = tokenList.filter((t: TokenInfo) => {
      const isSollet = t.tags?.includes(SPL_REGISTRY_SOLLET_TAG);
      return isSollet;
    });
    tokens.sort((a: TokenInfo, b: TokenInfo) =>
      a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0
    );
    return [
      tokens,
      new Map<string, TokenInfo>(tokens.map((t: TokenInfo) => [t.address, t])),
    ];
  }, [tokenList]);

  // Wormhole wrapped tokens.
  const [swappableTokensWormhole, wormholeMap] = useMemo(() => {
    const tokens = tokenList.filter((t: TokenInfo) => {
      const isSollet = t.tags?.includes(SPL_REGISTRY_WORM_TAG);
      return isSollet;
    });
    tokens.sort((a: TokenInfo, b: TokenInfo) =>
      a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0
    );
    return [
      tokens,
      new Map<string, TokenInfo>(tokens.map((t: TokenInfo) => [t.address, t])),
    ];
  }, [tokenList]);

  let [tokenBase, setTokenBase] = useState<TokenCommonBaseInfo[] | undefined>(
    undefined
  );
  let [addrList, setValues, removeValue] = LocalStorage("swapui-common-bases");

  // Common token bases
  useEffect(() => {
    if (addrList == null) {
      addrList = props.commonBases ?? [];
    }
    if (props.commonBases) {
      props.commonBases.forEach((add: any) => setValues(add.toString()));
      addrList.concat(props.commonBases);
    }
    addrList = addrList.map((e: string) => new PublicKey(e.toString()));
    const cb = addrList?.map((add: PublicKey) => {
      const token = tokenMap.get(add.toString());

      if (token) {
        // save in react state
        token.isCommonBase = true;

        // save in persistent storage
        setValues(token.address);
      }
      
      return token;
    });
    setTokenBase(cb);
    return cb;
  }, [props.commonBases]);

  const addNewBase = (token: TokenInfo) => {
    // Check if token already a common base
    if (
      tokenBase?.some((t) => token.address.toString() === t.address.toString())
    ) {
      return;
    }
    const c: TokenCommonBaseInfo = { ...token, isCommonBase: true };
    setValues(token.address);
    setTokenBase((prevState) => [...(prevState as TokenCommonBaseInfo[]), c]);
  };

  const removeBase = (token: TokenInfo) => {
    const index =
      tokenBase?.findIndex(
        (t) => token.address.toString() === t.address.toString()
      ) ?? -1;
    // return if not found
    if (index == -1) return;
    const tempTokenBase = tokenBase?.slice();
    tempTokenBase?.splice(index, 1);
    setTokenBase(tempTokenBase);
    removeValue(index);
  };

  // Token map for quick lookup.
  const tokenBaseMap = useMemo(() => {
    const tokenBaseMap = new Map();
    tokenBase?.forEach((t: TokenCommonBaseInfo) => {
      tokenBaseMap.set(t.address, t);
    });
    return tokenBaseMap;
  }, [tokenBase]);

  return (
    <_TokenListContext.Provider
      value={{
        tokenMap,
        wormholeMap,
        solletMap,
        swappableTokens,
        swappableTokensWormhole,
        swappableTokensSollet,
        tokenBase,
        addNewBase,
        removeBase,
        tokenBaseMap,
      }}
    >
      {props.children}
    </_TokenListContext.Provider>
  );
}

export function useTokenListContext(): TokenListContext {
  const ctx = useContext(_TokenListContext);
  if (ctx === null) {
    throw new Error("Context not available");
  }
  return ctx;
}

export function useTokenMap(): Map<string, TokenInfo> {
  const { tokenMap } = useTokenListContext();
  return tokenMap;
}

export function useSwappableTokens() {
  const { swappableTokens, swappableTokensWormhole, swappableTokensSollet } =
    useTokenListContext();
  return {
    swappableTokens,
    swappableTokensWormhole,
    swappableTokensSollet,
  };
}

export function useTokenBase() {
  const { tokenBase, addNewBase, tokenBaseMap, removeBase } =
    useTokenListContext();
  return {
    tokenBase,
    addNewBase,
    tokenBaseMap,
    removeBase,
  };
}
