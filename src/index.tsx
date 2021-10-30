import {
  createTheme,
  ThemeOptions,
  ThemeProvider,
} from "@material-ui/core/styles";
import { Provider } from "@project-serum/anchor";
import { Swap as SwapClient } from "@project-serum/swap";
import { TokenListContainer } from "@solana/spl-token-registry";
import { PublicKey } from "@solana/web3.js";
import { ReactElement, Suspense } from "react";
import { I18nextProvider } from "react-i18next";
import { LangOption } from "./utils/types";
import SwapCard, {
  ArrowButton,
  SwapButton,
  SwapHeader,
  SwapTokenForm,
} from "./components/Swap";
import TokenDialog from "./components/TokenDialog";
import {
  DexContextProvider,
  useBbo,
  useFairRoute,
  useMarketName,
} from "./context/Dex";
import {
  SwapContextProvider,
  useSwapContext,
  useSwapFair,
} from "./context/Swap";
import { TokenContextProvider, useTokenContext } from "./context/Token";
import { TokenListContextProvider, useTokenListContext } from "./context/TokenList";
import I18n from "./i18n";
import { LanguageToggle } from "./components/LanguageToggle";

/**
 * A`Swap` component that can be embedded into applications. To use,
 * one can, minimally, provide a provider and token list to the component.
 * For example,
 *
 * ```javascript
 * <Swap provider={provider} tokenList={tokenList} />
 * ```
 *
 * All of the complexity of communicating with the Serum DEX and managing
 * its data is handled internally by the component.
 *
 * For information on other properties like earning referrals, see the
 * [[SwapProps]] documentation.
 */
export default function Swap(props: SwapProps): ReactElement {
  const {
    containerStyle,
    contentStyle,
    swapTokenContainerStyle,
    swapButtonStyle,
    connectWalletCallback,
    materialTheme,
    provider,
    tokenList,
    commonBases,
    fromMint,
    toMint,
    fromAmount,
    toAmount,
    referral,
    langOption
  } = props;

  // Remove hindi after testing
  const l: LangOption = { en: { nativeName: "English" }, "hi-IN": { nativeName: "Hindi" }, "fr": { nativeName: "French" }, ...langOption };

  // @ts-ignore
  const swapClient = new SwapClient(provider, tokenList);
  const theme = createTheme(
    materialTheme || {
      palette: {
        // type: "dark",
        primary: {
          main: "#2196F3",
          contrastText: "#FFFFFF",
        },
        secondary: {
          main: "#E0E0E0",
          light: "#595959",
        },
        error: {
          main: "#ff6b6b",
        },
      },
    }
  );
  return (
    <Suspense fallback="loading..">
      <I18nextProvider i18n={I18n}>

        <ThemeProvider theme={theme}>
          <TokenContextProvider provider={provider}>
            <TokenListContextProvider
              tokenList={tokenList}
              commonBases={commonBases}
              provider={provider}
            >
              <DexContextProvider swapClient={swapClient}>
                <SwapContextProvider
                  fromMint={fromMint}
                  toMint={toMint}
                  fromAmount={fromAmount}
                  toAmount={toAmount}
                  referral={referral}
                >
                  <SwapCard
                    containerStyle={containerStyle}
                    contentStyle={contentStyle}
                    swapTokenContainerStyle={swapTokenContainerStyle}
                    swapButtonStyle={swapButtonStyle}
                    connectWalletCallback={connectWalletCallback}
                  />
                  {/*  This is not required. 
                  Language will be automatically read from the browser. 
                  For testing only */}
                  <LanguageToggle langOption={l} />
                </SwapContextProvider>
              </DexContextProvider>
            </TokenListContextProvider>
          </TokenContextProvider>
        </ThemeProvider>
      </I18nextProvider>
    </Suspense>
  );
}

/**
 * Properties for the `Swap` Component.
 */
export type SwapProps = {
  /**
   * Wallet and network provider. Apps can use a `Provider` subclass to hook
   * into all transactions intitiated by the component.
   */
  provider: Provider;

  /**
   * Token list providing information for tokens used.
   */
  tokenList: TokenListContainer;

  /**
   * List of token address that should show up as common base tokens
   */
  commonBases?: PublicKey[];

  /**
   * Wallet address to which referral fees are sent (i.e. a SOL address).
   * To receive referral fees, the wallet must *own* associated token
   * accounts for the token in which the referral is paid  (usually USDC
   * or USDT).
   */
  referral?: PublicKey;

  /**
   * The default `fromMint` to use when the component first renders.
   */
  fromMint?: PublicKey;

  /**
   * The default `toMint` to use when the component first renders.
   */
  toMint?: PublicKey;

  /**
   * The initial amount for the `fromMint` to use when the component first
   * renders.
   */
  fromAmount?: number;

  /**
   * The initial amount for the `toMint` to use when the component first
   * renders.
   */
  toAmount?: number;

  /**
   * Provide custom material-ui theme.
   */
  materialTheme?: ThemeOptions;

  /**
   * Styling properties for the main container.
   */
  containerStyle?: any;

  /**
   * Styling properties for the content container.
   */
  contentStyle?: any;

  /**
   * Styling properties for the from and to token containers.
   */
  swapTokenContainerStyle?: any;
  /**
   * Styling properties for the Swap Button.
   */
  swapButtonStyle?: any;
  /**
   * Callback for wallet connection
   */
  connectWalletCallback?: any;
  /**
   * Pass language options for i18n
   */
  langOption?: LangOption;
};

export {
  Swap,
  SwapCard,
  SwapHeader,
  SwapTokenForm,
  ArrowButton,
  SwapButton,
  TokenDialog,
  // Providers and context.
  // Swap.
  SwapContextProvider,
  useSwapContext,
  useSwapFair,
  // TokenList.
  TokenListContextProvider,
  useTokenListContext,
  // Token.
  TokenContextProvider,
  useTokenContext,
  // Dex.
  DexContextProvider,
  useFairRoute,
  useMarketName,
  useBbo,
};
