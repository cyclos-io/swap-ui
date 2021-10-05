import React, { useContext, useState, useEffect } from "react";
import { useAsync } from "react-async-hook";
import { Provider, BN } from "@project-serum/anchor";
import { PublicKey, Account, Keypair } from "@solana/web3.js";
import {
  MintInfo,
  AccountInfo as TokenAccountInfo,
  Token,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  getOwnedAssociatedTokenAccounts,
  parseTokenAccountData,
} from "../utils/tokens";
import { SOL_MINT } from "../utils/pubkeys";
import { token } from "@project-serum/anchor/dist/utils";
import useInterval from "@use-it/interval";
import { useSwapContext } from "..";

export type CachedToken = {
  publicKey: PublicKey; // Token account address for user, TODO read from account directly
  account: TokenAccountInfo;
};

export type TokenContext = {
  provider: Provider;
  isLoaded: boolean;

  // TODO store as map instead of array
  userTokens: CachedToken[],
  setUserTokens: React.Dispatch<React.SetStateAction<CachedToken[]>>;
};

const _TokenContext = React.createContext<TokenContext | null>(null);
/**
 * Observe token balances of the user using websockets
 * Expose function to allow balances to be refetched
 * @param props 
 * @returns 
 */
export function TokenContextProvider({provider, children}: {provider: Provider, children: React.ReactNode}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [userTokens, setUserTokens] = useState<CachedToken[]>([])

  // Fetch all the owned token accounts for the wallet.
  useEffect(() => {
    if (!provider.wallet.publicKey) {
      return;
    }

    // Fetch all SPL tokens belonging to the user
    getOwnedAssociatedTokenAccounts(
      provider.connection,
      provider.wallet.publicKey
    ).then((accs) => {
      if (accs) {
        // @ts-ignore
        setUserTokens(accs);
      }
      setIsLoaded(true);
    });
    // Fetch SOL balance.
    provider.connection
      .getAccountInfo(provider.wallet.publicKey)
      .then((acc) => {
        if (acc) {

          // @ts-ignore
          setUserTokens([...userTokens, {
            publicKey: provider.wallet.publicKey,
            
            // @ts-ignore
            account: {
              amount: new BN(acc.lamports),
              mint: SOL_MINT,
            },
          }])
        }
      });
  }, [provider.wallet.publicKey, provider.connection]);

  return (
    <_TokenContext.Provider
      value={{
        provider,
        isLoaded,
        userTokens,
        setUserTokens,
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

export function usePollForBalance() {
  const { fromMint, toMint } = useSwapContext()
  const { provider, userTokens, setUserTokens } = useTokenContext();
  const poll = fromMint && toMint && provider.wallet.publicKey 

  useInterval(async () => {
    console.log('polled')
    const clonedTokens = [...userTokens];

    [fromMint, toMint].forEach(async (mint) => {
      const savedTokenInfo = clonedTokens.find(token => token.account.mint.equals(mint))
      if (savedTokenInfo) {
        if (mint.equals(SOL_MINT)) {
          const lamportsBal = await provider.connection.getBalance(provider.wallet.publicKey)
          console.log('Lamports balance', lamportsBal)
  
          savedTokenInfo.account.amount = new BN(lamportsBal);
        } else {
          const token = new Token(
            provider.connection,
            mint,
            TOKEN_PROGRAM_ID,
            new Keypair()
          )
          const updatedTokenInfo = await token.getAccountInfo(savedTokenInfo.publicKey)
          if (!updatedTokenInfo.amount.eq(savedTokenInfo.account.amount)) {
            savedTokenInfo.account = updatedTokenInfo;
          }
        }
      }
    })
    setUserTokens(clonedTokens)
  }, poll ? 8000 : null);
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
): { publicKey: PublicKey; account: TokenAccountInfo } | null | undefined {
  const { provider, userTokens, setUserTokens } = useTokenContext();

  const tokenAccountIndex = userTokens.findIndex(token => {
    return mint && token.account.mint.equals(mint)
  })

  let tokenAccount: CachedToken | undefined

  if (tokenAccountIndex !== -1) {
    tokenAccount = userTokens[tokenAccountIndex]
  }
  const isSol = mint?.equals(SOL_MINT);

  // Loading
  if (mint === undefined) {
    return undefined;
  }

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
      new Account()
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


