import React, { useContext, useState } from "react";
import { Provider } from "@project-serum/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useInterval } from "usehooks-ts";

import { SOL_MINT } from "../utils/pubkeys";
import {
  FetchedTokens,
  fetchSolPrice,
  fetchUserTokens,
  SavedTokenInfo,
} from "../utils/userTokens";

export type TokenContext = {
  provider: Provider;
  userTokens?: FetchedTokens | "fetching";
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
  const [userTokens, setUserTokens] = useState<FetchedTokens | "fetching">();
  const poll = provider.wallet.publicKey && provider.connection;
  let pollDuration = poll ? 10000 : null;

  if (poll && !userTokens && userTokens !== "fetching") {
    pollDuration = 0;
  }
  // Poll for user tokens from Solscan
  useInterval(async () => {
    try {
      if (!userTokens) {
        setUserTokens("fetching");
      }

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
  if (mint === undefined || userTokens === "fetching") {
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
