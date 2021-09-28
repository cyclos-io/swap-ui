import { PublicKey } from "@solana/web3.js";

export type OwnedTokenDetailed = {
  address: string;
  balance: number;
  usd: number;
}

// TODO: get tokens owned by user
export const getUserTokens = (pk: PublicKey | undefined): OwnedTokenDetailed[] => {
  if (!pk) return [];
  return [
    { address: "Ejmc1UB4EsES5oAaRN63SpoxMJidt3ZGBrqrZk49vjTZ", balance: 24, usd: 4000.00 },
    { address: "SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt", balance: 1, usd: 8.00 },
    { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", balance: 100, usd: 100.00 },
  ]
}