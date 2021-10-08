import React, { useContext, useState } from "react";
import { Provider } from "@project-serum/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
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
