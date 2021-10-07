export type OwnedTokenDetailed = {
  address: string;
  balance: string;
  usd: number;
};

export const fetchSolPrice = async (): Promise<number> => {
  try {
    const response = await fetch("https://api.solscan.io/market?symbol=SOL");
    const json = await response.json();
    return json.data.priceUsdt;
  } catch (error) {
    console.error(error);
    return 0;
  }
};

export const getUserTokens = async (
  pk?: string
): Promise<OwnedTokenDetailed[]> => {
  let data: OwnedTokenDetailed[] = [];

  try {
    if (pk) {
      let tokens = await (
        await fetch(
          `https://api.solscan.io/account/tokens?address=${pk}&price=1`
        )
      ).json();
      data = tokens.data.map((token: any) => {
        return {
          address: token.tokenAddress,
          balance: token.tokenAmount.uiAmountString,
          usd: +(token.tokenAmount.uiAmount * (token.priceUsdt ?? 0)).toFixed(
            4
          ),
        };
      });
    }
  } catch (error) {
    console.error(error);
  }

  return data.filter((t: OwnedTokenDetailed) => +t.balance > 0);
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
