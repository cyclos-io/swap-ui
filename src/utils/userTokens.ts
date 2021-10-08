export type OwnedTokenDetailed = {
  address: string;
  balance: string;
  usd: number;
};

type SolscanToken = {
  tokenAddress: string;
  tokenAccount: string;
  tokenSymbol: string;
  tokenAmount: {
    uiAmount: number;
  };
  priceUsdt?: number;
};

export type SavedTokenInfo = {
  tokenAccount: string;
  tokenSymbol: string;
  tokenAmount: number;
  priceUsdt?: number;
};

export type FetchedTokens = {
  [tokenAddress: string]: SavedTokenInfo | undefined;
};

export const fetchSolPrice = async (): Promise<number> => {
  const response = await fetch("https://api.solscan.io/market?symbol=SOL");
  const json = await response.json();
  return json.data.priceUsdt;
};

export async function fetchUserTokens(address: string) {
  const tokens = await (
    await fetch(
      `https://api.solscan.io/account/tokens?address=${address}&price=1`
    )
  ).json();
  const tokenData = tokens.data as SolscanToken[];
  const userTokens: FetchedTokens = {};

  tokenData.forEach((token) => {
    const { tokenAddress, tokenAccount, tokenSymbol, tokenAmount, priceUsdt } =
      token;
    userTokens[tokenAddress] = {
      tokenAccount,
      tokenSymbol,
      tokenAmount: tokenAmount.uiAmount,
      priceUsdt,
    };
  });
  return userTokens;
}
