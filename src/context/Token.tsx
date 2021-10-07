import React, { useContext, useState } from "react";
import { useAsync } from "react-async-hook";
import { Provider } from "@project-serum/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { MintInfo, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import useInterval from "@use-it/interval";

import { SOL_MINT } from "../utils/pubkeys";
import {
  FetchedTokens,
  fetchSolPrice,
  fetchUserTokens,
  SavedTokenInfo,
} from "../utils/userTokens";

export type TokenContext = {
  provider: Provider;
  userTokens?: FetchedTokens;
};

const _TokenContext = React.createContext<TokenContext | null>(null);

/**
 * Provider for user token balances
 * Token balances are polled at fixed intervals
 * @returns
 */
export function TokenContextProvider({
  provider,
  children,
}: {
  provider: Provider;
  children: React.ReactNode;
}) {
  const [userTokens, setUserTokens] = useState<FetchedTokens>();
  const poll = provider.wallet.publicKey && provider.connection;
  const pollDuration = poll
    ? !userTokens // no delay for first fetch
      ? 0
      : 5000
    : null;

  useInterval(async () => {
    try {
      const fetchedTokens = await fetchUserTokens(
        provider.wallet.publicKey.toString()
      );
      // Add SOL to token list
      const lamportsBal = await provider.connection.getBalance(
        provider.wallet.publicKey
      );
      fetchedTokens[SOL_MINT.toString()] = {
        tokenAccount: "",
        tokenSymbol: "SOL",
        tokenAmount: lamportsBal / LAMPORTS_PER_SOL,
        priceUsdt: await fetchSolPrice(),
      };

      setUserTokens(fetchedTokens);
    } catch (error) {
      console.error(error);
    }
  }, pollDuration);

  return (
    <_TokenContext.Provider
      value={{
        provider,
        userTokens,
      }}
    >
      {children}
    </_TokenContext.Provider>
  );
}

export function useTokenContext() {
  const ctx = useContext(_TokenContext);
  if (ctx === null) {
    throw new Error("Context not available");
  }
  return ctx;
}

/**
 * Hook to return token balance of user for given mint
 * @param mint
 * @returns
 */
// Null => none exists.
// Undefined => loading.
export function useOwnedTokenAccount(
  mint?: PublicKey
): SavedTokenInfo | undefined | null {
  const { userTokens } = useTokenContext();
  // Loading
  if (mint === undefined) {
    return undefined;
  }

  const isSol = mint?.equals(SOL_MINT);
  const tokenAccount = userTokens?.[mint.toString()];

  // Account for given mint does not exist
  if (!isSol && !tokenAccount) {
    return null;
  }

  return tokenAccount;
}

// Cache storing all previously fetched mint infos.
// Initially SOL_MINT and mints of existing token accounts are stored
// A mint is added for each new token opened
// @ts-ignore
const _MINT_CACHE = new Map<string, Promise<MintInfo>>([
  [SOL_MINT.toString(), { decimals: 9 }],
]);

export function setMintCache(pk: PublicKey, account: MintInfo) {
  _MINT_CACHE.set(pk.toString(), new Promise((resolve) => resolve(account)));
}

/**
 * Return mint info for given mint address
 * @param mint
 * @returns
 */
export function useMint(mint?: PublicKey): MintInfo | undefined | null {
  const { provider } = useTokenContext();
  // Lazy load the mint account if needeed.
  const asyncMintInfo = useAsync(async () => {
    if (!mint) {
      return undefined;
    }
    if (_MINT_CACHE.get(mint.toString())) {
      return _MINT_CACHE.get(mint.toString());
    }

    const mintClient = new Token(
      provider.connection,
      mint,
      TOKEN_PROGRAM_ID,
      new Keypair()
    );
    const mintInfo = mintClient.getMintInfo();
    _MINT_CACHE.set(mint.toString(), mintInfo);
    return mintInfo;
  }, [provider.connection, mint]);

  if (asyncMintInfo.result) {
    return asyncMintInfo.result;
  }
  return undefined;
}
