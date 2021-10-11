import {
  Avatar,
  Box,
  Button,
  Card,
  makeStyles,
  TextField,
  Typography,
  useTheme,
  IconButton,
  Collapse,
} from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import {
  ExpandMore,
  ImportExportRounded,
  WarningOutlined,
  Close as CloseIcon,
} from "@material-ui/icons";
import { BN, Provider } from "@project-serum/anchor";
import { OpenOrders } from "@project-serum/serum";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  Signer,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { useMemo, useState } from "react";
import {
  FEE_MULTIPLIER,
  useDexContext,
  useMarket,
  useRoute,
  useRouteVerbose,
  useUnsettle,
} from "../context/Dex";
import {
  useCanCreateAccounts,
  useCanSwap,
  useCanWrapOrUnwrap,
  useIsUnwrapSollet,
  useIsWrapSol,
  useMinSwapAmount,
  useReferral,
  useSwapContext,
  useSwapFair,
} from "../context/Swap";
import {
  addTokensToCache,
  CachedToken,
  useMint,
  useOwnedTokenAccount,
  useTokenContext,
} from "../context/Token";
import { useTokenMap } from "../context/TokenList";
import {
  DEX_PID,
  MEMO_PROGRAM_ID,
  SOLLET_USDT_MINT,
  SOL_MINT,
  WRAPPED_SOL_MINT,
} from "../utils/pubkeys";
import { getTokenAddrressAndCreateIx } from "../utils/tokens";
import { InfoButton, InfoLabel } from "./Info";
import TokenDialog from "./TokenDialog";

const useStyles = makeStyles((theme) => ({
  container: {
    width: theme.spacing(54),
  },
  card: {
    borderRadius: theme.spacing(2),
    boxShadow: "0px 0px 30px 5px rgba(0,0,0,0.075)",
    padding: theme.spacing(2),
  },
  alert: {
    borderRadius: theme.spacing(2),
    boxShadow: "0px 0px 30px 5px rgba(0,0,0,0.075)",
    marginTop: theme.spacing(1),
  },
  tab: {
    width: "50%",
  },
  settingsButton: {
    padding: 0,
  },
  swapButton: {
    width: "100%",
    borderRadius: theme.spacing(2),
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontSize: 16,
    fontWeight: 700,
    padding: theme.spacing(1.5),
    "&:disabled": {
      cursor: "not-allowed",
      pointerEvents: "all !important",
    },
  },
  swapToFromButton: {
    display: "block",
    margin: "0px auto 0px auto",
    cursor: "pointer",
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.spacing(1),
    boxShadow: "0px 0px 2px 1px rgba(33,150,243,0.1)",
    fontSize: theme.spacing(4),
  },
  amountInput: {
    fontSize: 22,
    fontWeight: 600,
  },
  input: {
    textAlign: "right",
  },
  swapTokenFormContainer: {
    borderRadius: theme.spacing(2),
    boxShadow: "0px 0px 15px 2px rgba(33,150,243,0.1)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-around",
    padding: theme.spacing(1),
  },
  swapTokenSelectorContainer: {
    marginLeft: theme.spacing(1),
    display: "flex",
    flexDirection: "column",
    width: "50%",
  },
  balanceContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(0.5),
    fontSize: "14px",
    minHeight: theme.spacing(3.8),
  },
  maxButton: {
    marginLeft: theme.spacing(2),
    color: theme.palette.primary.main,
    fontWeight: 700,
    fontSize: "12px",
    textTransform: "none",
    maxWidth: "min-content",
    minWidth: "min-content",
  },
  tokenButton: {
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    marginBottom: theme.spacing(1),
  },
  infoButton: {
    marginLeft: "5px",
    padding: 0,
    fontSize: "14px",
  },
  settleButton: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    cursor: "pointer",
    marginLeft: "auto",
  },
}));

export default function SwapCard({
  containerStyle,
  contentStyle,
  swapTokenContainerStyle,
  swapButtonStyle,
  connectWalletCallback,
}: {
  containerStyle?: any;
  contentStyle?: any;
  swapTokenContainerStyle?: any;
  swapButtonStyle?: any;
  connectWalletCallback?: any;
}) {
  const styles = useStyles();
  const { isUnsettledAmt } = useUnsettle();
  let [openWarning, setOpenWarning] = useState(isUnsettledAmt);
  useMemo(() => {
    setOpenWarning(isUnsettledAmt);
  }, [isUnsettledAmt]);

  return (
    <div className={styles.container}>
      <Card className={styles.card} style={containerStyle}>
        <SwapHeader />
        <div style={contentStyle}>
          <SwapFromForm style={swapTokenContainerStyle} />
          <ArrowButton style={swapTokenContainerStyle} />
          <SwapToForm style={swapTokenContainerStyle} />
          <InfoLabel />
          <SwapButton
            swapButtonStyle={swapButtonStyle}
            connectWalletCallback={connectWalletCallback}
          />
        </div>
      </Card>
      <SwapWarning
        style={containerStyle}
        open={openWarning}
        setOpen={setOpenWarning}
      />
    </div>
  );
}

export function SwapWarning({
  style,
  open,
  setOpen,
}: {
  style: any;
  open: any;
  setOpen: any;
}) {
  const styles = useStyles();
  const { settleAll } = useUnsettle();
  return (
    <Collapse in={open} unmountOnExit>
      <Card className={styles.alert} style={style}>
        <Alert
          severity="warning"
          action={
            <>
              <Button
                variant="text"
                style={{ textTransform: "none" }}
                size="small"
                color="primary"
                onClick={settleAll}
              >
                Settle All
              </Button>
              &nbsp;&nbsp;
              <IconButton
                aria-label="close"
                color="inherit"
                size="small"
                onClick={() => {
                  setOpen(false);
                }}
              >
                <CloseIcon fontSize="inherit" />
              </IconButton>
            </>
          }
        >
          <Typography variant="caption">
            You have some unsettled balance.
          </Typography>
        </Alert>
      </Card>
    </Collapse>
  );
}

export function SwapHeader() {
  const { fromMint, toMint } = useSwapContext();
  // Use last route item to find impact
  const route = useRoute(fromMint, toMint);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "16px",
      }}
    >
      <Typography
        style={{
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        SWAP
      </Typography>
      <InfoButton route={route} />
    </div>
  );
}

export function ArrowButton({ style }: { style?: any }) {
  const styles = useStyles();
  const theme = useTheme();
  const { swapToFromMints } = useSwapContext();
  return (
    <Box my={-1} position="relative">
      <ImportExportRounded
        className={styles.swapToFromButton}
        fontSize="large"
        style={style}
        htmlColor={theme.palette.primary.main}
        onClick={swapToFromMints}
      />
    </Box>
  );
}

function SwapFromForm({ style }: { style?: any }) {
  const { fromMint, setFromMint, fromAmount, setFromAmount } = useSwapContext();
  return (
    <SwapTokenForm
      from
      style={style}
      mint={fromMint}
      setMint={setFromMint}
      amount={fromAmount}
      setAmount={setFromAmount}
    />
  );
}

function SwapToForm({ style }: { style?: any }) {
  const { toMint, setToMint, toAmount, setToAmount } = useSwapContext();
  return (
    <SwapTokenForm
      from={false}
      style={style}
      mint={toMint}
      setMint={setToMint}
      amount={toAmount}
      setAmount={setToAmount}
    />
  );
}

export function SwapTokenForm({
  from,
  style,
  mint,
  setMint,
  amount,
  setAmount,
}: {
  from: boolean;
  style?: any;
  mint: PublicKey;
  setMint: (m: PublicKey) => void;
  amount: number;
  setAmount: (a: number) => void;
}) {
  const styles = useStyles();

  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const tokenAccount = useOwnedTokenAccount(mint);
  const mintAccount = useMint(mint);

  const balance =
    tokenAccount &&
    mintAccount &&
    tokenAccount.account.amount.toNumber() / 10 ** mintAccount.decimals;

  const formattedAmount =
    mintAccount && amount
      ? amount.toLocaleString("fullwide", {
          maximumFractionDigits: mintAccount.decimals,
          useGrouping: false,
        })
      : amount;

  const tokenDialog = useMemo(() => {
    return (
      <TokenDialog
        setMint={setMint}
        open={showTokenDialog}
        onClose={() => setShowTokenDialog(false)}
      />
    );
  }, [showTokenDialog]);

  return (
    <div className={styles.swapTokenFormContainer} style={style}>
      <Box display="flex" justifyContent="space-between">
        <Box className={styles.swapTokenSelectorContainer}>
          <TokenButton mint={mint} onClick={() => setShowTokenDialog(true)} />
        </Box>
        <TextField
          type="number"
          value={formattedAmount}
          onChange={(e) => setAmount(parseFloat(e.target.value))}
          InputProps={{
            disableUnderline: true,
            classes: {
              root: styles.amountInput,
              input: styles.input,
            },
          }}
        />
      </Box>
      <Box className={styles.balanceContainer}>
        {tokenAccount && mintAccount ? (
          <Box>
            <Typography variant="caption">
              <small>Balance:&nbsp;</small>
            </Typography>
            {/* <Typography color="textSecondary"> */}
            {balance?.toFixed(mintAccount.decimals)}
            {/* </Typography> */}
          </Box>
        ) : (
          `-`
        )}
        {!!balance && (
          <div>
            <Button
              variant="text"
              size="small"
              className={styles.maxButton}
              onClick={() => setAmount(balance / 2)}
            >
              Half
            </Button>
            <Button
              variant="text"
              size="small"
              className={styles.maxButton}
              onClick={() => setAmount(balance)}
            >
              Max
            </Button>
          </div>
        )}
      </Box>

      {tokenDialog}
    </div>
  );
}

function TokenButton({
  mint,
  onClick,
}: {
  mint: PublicKey;
  onClick: () => void;
}) {
  const styles = useStyles();
  const theme = useTheme();

  return (
    <div onClick={onClick} className={styles.tokenButton}>
      <TokenIcon
        mint={mint}
        style={{ width: theme.spacing(4), height: theme.spacing(4) }}
      />
      <TokenName mint={mint} style={{ fontSize: 14, fontWeight: 700 }} />
      <ExpandMore />
    </div>
  );
}

export function TokenIcon({ mint, style }: { mint: PublicKey; style?: any }) {
  const tokenMap = useTokenMap();
  let tokenInfo = tokenMap.get(mint.toString());
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <Avatar alt={tokenInfo?.name} style={style} src={tokenInfo?.logoURI} />
    </div>
  );
}

function TokenName({ mint, style }: { mint: PublicKey; style: any }) {
  const tokenMap = useTokenMap();
  const theme = useTheme();
  let tokenInfo = tokenMap.get(mint.toString());
  return (
    <Typography
      style={{
        marginLeft: theme.spacing(2),
        marginRight: theme.spacing(1),
        ...style,
      }}
    >
      {tokenInfo?.symbol}
    </Typography>
  );
}

export function SwapButton({
  swapButtonStyle,
  connectWalletCallback,
}: {
  swapButtonStyle?: any;
  connectWalletCallback?: any;
}) {
  const styles = useStyles();
  const {
    fromMint,
    toMint,
    fromAmount,
    toAmount,
    slippage,
    isClosingNewAccounts,
    isStrict,
  } = useSwapContext();
  const {
    swapClient,
    isLoaded: isDexLoaded,
    addOpenOrderAccount,
    openOrders,
  } = useDexContext();
  const { isLoaded: isTokensLoaded, refreshTokenState } = useTokenContext();
  const tokenMap = useTokenMap();

  // Token to be traded away
  const fromMintInfo = useMint(fromMint);
  // End destination token
  const toMintInfo = useMint(toMint);

  const route = useRouteVerbose(fromMint, toMint);
  const fromMarket = useMarket(
    route && route.markets ? route.markets[0] : undefined
  );

  // Second market in case of multi-market swap
  const toMarket = useMarket(
    route && route.markets ? route.markets[1] : undefined
  );

  const toWallet = useOwnedTokenAccount(toMint);
  const fromWallet = useOwnedTokenAccount(fromMint);

  // Intermediary token for multi-market swaps, eg. USDC in a SRM -> BTC swap
  const quoteMint = fromMarket && fromMarket.quoteMintAddress;
  const quoteMintInfo = useMint(quoteMint);
  const quoteWallet = useOwnedTokenAccount(quoteMint);
  const canCreateAccounts = useCanCreateAccounts();
  const canWrapOrUnwrap = useCanWrapOrUnwrap();
  const canSwap = useCanSwap();
  const referral = useReferral(fromMarket);
  const fair = useSwapFair();
  const minSwapAmount = useMinSwapAmount(fromMarket, toMarket);

  const { isWrapSol, isUnwrapSol } = useIsWrapSol(fromMint, toMint);
  const isUnwrapSollet = useIsUnwrapSollet(fromMint, toMint);

  const fromOpenOrders = useMemo(() => {
    return fromMarket
      ? openOrders.get(fromMarket?.address.toString())
      : undefined;
  }, [fromMarket, openOrders]);

  const toOpenOrders = useMemo(() => {
    return toMarket ? openOrders.get(toMarket?.address.toString()) : undefined;
  }, [toMarket, openOrders]);

  const disconnected = !swapClient.program.provider.wallet.publicKey;

  const insufficientBalance =
    fromAmount == 0 ||
    fromAmount * Math.pow(10, fromMintInfo?.decimals ?? 0) >
      (fromWallet?.account.amount.toNumber() ?? 0);

  const needsCreateAccounts =
    !toWallet ||
    (!isUnwrapSollet && (!fromOpenOrders || (toMarket && !toOpenOrders)));

  // Click handlers.

  /**
   * Find if OpenOrders or associated token accounts are required
   * for the swap, then send a create transaction
   */
  const sendCreateAccountsTransaction = async () => {
    if (!fromMintInfo || !toMintInfo) {
      throw new Error("Unable to calculate mint decimals");
    }
    if (!quoteMint || !quoteMintInfo) {
      throw new Error("Quote mint not found");
    }
    const tx = new Transaction();
    const signers = [];

    let toAssociatedPubkey!: PublicKey;
    let quoteAssociatedPubkey!: PublicKey;

    // Associated token account creation
    if (!toWallet) {
      const { tokenAddress, createTokenAddrIx } =
        await getTokenAddrressAndCreateIx(
          toMint,
          swapClient.program.provider.wallet.publicKey
        );
      toAssociatedPubkey = tokenAddress;
      tx.add(createTokenAddrIx);
    }

    if (!quoteWallet && !quoteMint.equals(toMint)) {
      const { tokenAddress, createTokenAddrIx } =
        await getTokenAddrressAndCreateIx(
          quoteMint,
          swapClient.program.provider.wallet.publicKey
        );
      quoteAssociatedPubkey = tokenAddress;
      tx.add(createTokenAddrIx);
    }
    // No point of initializing from wallet, as user won't have tokens there

    // Helper functions for OpenOrders

    /**
     * Add instructions to init and create an OpenOrders account
     * @param openOrdersKeypair
     * @param market
     * @param tx
     */
    async function getInitOpenOrdersIx(
      openOrdersKeypair: Keypair,
      market: PublicKey,
      tx: Transaction
    ) {
      const createOoIx = await OpenOrders.makeCreateAccountTransaction(
        swapClient.program.provider.connection,
        market,
        swapClient.program.provider.wallet.publicKey,
        openOrdersKeypair.publicKey,
        DEX_PID
      );
      const initAcIx = swapClient.program.instruction.initAccount({
        accounts: {
          openOrders: openOrdersKeypair.publicKey,
          authority: swapClient.program.provider.wallet.publicKey,
          market: market,
          dexProgram: DEX_PID,
          rent: SYSVAR_RENT_PUBKEY,
        },
      });
      tx.add(createOoIx);
      tx.add(initAcIx);
    }

    /**
     * Save data of newly created OpenOrders account in cache
     * TODO: generate object client side to save a network call
     * @param openOrdersAddress
     */
    async function saveOpenOrders(openOrdersAddress: PublicKey) {
      const generatedOpenOrders = await OpenOrders.load(
        swapClient.program.provider.connection,
        openOrdersAddress,
        DEX_PID
      );
      addOpenOrderAccount(generatedOpenOrders.market, generatedOpenOrders);
    }

    // Open order accounts for to / from wallets. Generate if not already present
    let ooFrom!: Keypair;
    let ooTo!: Keypair;
    if (fromMarket && !fromOpenOrders) {
      ooFrom = Keypair.generate();
      await getInitOpenOrdersIx(ooFrom, fromMarket.address, tx);
      signers.push(ooFrom);
    }
    if (toMarket && !toOpenOrders) {
      ooTo = Keypair.generate();
      await getInitOpenOrdersIx(ooTo, toMarket.address, tx);
      signers.push(ooTo);
    }

    try {
      // Send transaction to create accounts
      await swapClient.program.provider.send(tx, signers);

      // Save OpenOrders to cache
      if (ooFrom) {
        await saveOpenOrders(ooFrom.publicKey);
      }
      if (ooTo) {
        await saveOpenOrders(ooTo.publicKey);
      }

      // Save created associated token accounts to cache
      const tokensToAdd: CachedToken[] = [];
      if (toAssociatedPubkey) {
        tokensToAdd.push(
          getNewTokenAccountData(
            toAssociatedPubkey,
            toMint,
            swapClient.program.provider.wallet.publicKey
          )
        );
      }
      if (quoteAssociatedPubkey && !quoteMint.equals(toMint)) {
        tokensToAdd.push(
          getNewTokenAccountData(
            quoteAssociatedPubkey,
            quoteMint,
            swapClient.program.provider.wallet.publicKey
          )
        );
      }
      addTokensToCache(tokensToAdd);

      // Refresh UI to display balance of the created token account
      refreshTokenState();
    } catch (error) {}
  };

  const sendWrapSolTransaction = async () => {
    if (!fromMintInfo || !toMintInfo) {
      throw new Error("Unable to calculate mint decimals");
    }
    if (!quoteMint || !quoteMintInfo) {
      throw new Error("Quote mint not found");
    }
    const amount = new u64(fromAmount * 10 ** fromMintInfo.decimals);

    // If the user already has a wrapped SOL account, then we perform a
    // transfer to the existing wrapped SOl account by
    //
    // * generating a new one
    // * minting wrapped sol
    // * sending tokens to the previously existing wrapped sol account
    // * closing the newly created wrapped sol account
    //
    // If a wrapped SOL account doesn't exist, then we create an associated
    // token account to mint the SOL and then leave it open.
    //
    const wrappedSolAccount = toWallet ? Keypair.generate() : undefined;
    const wrappedSolPubkey = wrappedSolAccount
      ? wrappedSolAccount.publicKey
      : await Token.getAssociatedTokenAddress(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          fromMint,
          swapClient.program.provider.wallet.publicKey
        );

    // Wrap the SOL.
    const { tx, signers } = await wrapSol(
      swapClient.program.provider,
      fromMint,
      amount,
      wrappedSolAccount
    );

    // Close the newly created account, if needed.
    if (toWallet) {
      tx.add(
        Token.createTransferInstruction(
          TOKEN_PROGRAM_ID,
          wrappedSolPubkey,
          toWallet.publicKey,
          swapClient.program.provider.wallet.publicKey,
          [],
          amount
        )
      );
      const { tx: unwrapTx, signers: unwrapSigners } = unwrapSol(
        swapClient.program.provider,
        wrappedSolPubkey
      );
      tx.add(unwrapTx);
      signers.push(...unwrapSigners);
    }
    await swapClient.program.provider.send(tx, signers);
  };

  const sendUnwrapSolTransaction = async () => {
    if (!fromMintInfo || !toMintInfo) {
      throw new Error("Unable to calculate mint decimals");
    }
    if (!quoteMint || !quoteMintInfo) {
      throw new Error("Quote mint not found");
    }
    const amount = new u64(fromAmount * 10 ** fromMintInfo.decimals);

    // Unwrap *without* closing the existing wrapped account:
    //
    // * Create a new Wrapped SOL account.
    // * Send wrapped tokens there.
    // * Unwrap (i.e. close the newly created wrapped account).
    const wrappedSolAccount = Keypair.generate();
    const { tx, signers } = await wrapSol(
      swapClient.program.provider,
      fromMint,
      amount,
      wrappedSolAccount
    );
    tx.add(
      Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        fromWallet!.publicKey,
        wrappedSolAccount.publicKey,
        swapClient.program.provider.wallet.publicKey,
        [],
        amount
      )
    );
    const { tx: unwrapTx, signers: unwrapSigners } = unwrapSol(
      swapClient.program.provider,
      wrappedSolAccount.publicKey
    );
    tx.add(unwrapTx);
    signers.push(...unwrapSigners);

    await swapClient.program.provider.send(tx, signers);
  };

  const sendUnwrapSolletTransaction = async () => {
    interface SolletBody {
      address: string;
      blockchain: string;
      coin: string;
      size: number;
      wusdtToUsdt?: boolean;
      wusdcToUsdc?: boolean;
    }
    const solletReqBody: SolletBody = {
      address: toWallet!.publicKey.toString(),
      blockchain: "sol",
      coin: toMint.toString(),
      size: 1,
    };
    if (fromMint.equals(SOLLET_USDT_MINT)) {
      solletReqBody.wusdtToUsdt = true;
    } else {
      solletReqBody.wusdcToUsdc = true;
    }
    const solletRes = await fetch("https://swap.sollet.io/api/swap_to", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(solletReqBody),
    });

    const { address: bridgeAddr, maxSize } = (await solletRes.json())
      .result as {
      address: string;
      maxSize: number;
    };

    const tx = new Transaction();
    const amount = new u64(fromAmount * 10 ** fromMintInfo!.decimals);
    tx.add(
      Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        fromWallet!.publicKey,
        new PublicKey(bridgeAddr),
        swapClient.program.provider.wallet.publicKey,
        [],
        amount
      )
    );
    tx.add(
      new TransactionInstruction({
        keys: [],
        data: Buffer.from(toWallet!.publicKey.toString(), "utf-8"),
        programId: MEMO_PROGRAM_ID,
      })
    );

    await swapClient.program.provider.send(tx);
  };

  const sendSwapTransaction = async () => {
    if (!fromMintInfo || !toMintInfo) {
      throw new Error("Unable to calculate mint decimals");
    }
    if (!fair) {
      throw new Error("Invalid fair");
    }
    if (!quoteMint || !quoteMintInfo) {
      throw new Error("Quote mint not found");
    }

    const amount = new BN(fromAmount * 10 ** fromMintInfo.decimals);
    const isSol = fromMint.equals(SOL_MINT) || toMint.equals(SOL_MINT);
    const wrappedSolAccount = isSol ? Keypair.generate() : undefined;

    // Build the swap.
    let txs = await (async () => {
      if (!fromMarket) {
        throw new Error("Market undefined");
      }

      const minExchangeRate = {
        rate: new BN((10 ** toMintInfo.decimals * FEE_MULTIPLIER) / fair)
          .muln(100 - slippage)
          .divn(100),
        fromDecimals: fromMintInfo.decimals,
        quoteDecimals: quoteMintInfo.decimals,
        strict: isStrict,
      };
      const fromWalletAddr = fromMint.equals(SOL_MINT)
        ? wrappedSolAccount!.publicKey
        : fromWallet
        ? fromWallet.publicKey
        : undefined;
      const toWalletAddr = toMint.equals(SOL_MINT)
        ? wrappedSolAccount!.publicKey
        : toWallet
        ? toWallet.publicKey
        : undefined;

      const fromOpenOrdersList = openOrders.get(fromMarket?.address.toString());
      let fromOpenOrders: PublicKey | undefined = undefined;
      if (fromOpenOrdersList) {
        fromOpenOrders = fromOpenOrdersList[0].address;
      }

      return await swapClient.swapTxs({
        fromMint,
        toMint,
        quoteMint,
        amount,
        minExchangeRate,
        referral,
        fromMarket,
        toMarket,
        // Automatically created if undefined.
        fromOpenOrders,
        toOpenOrders: toOpenOrders ? toOpenOrders[0].address : undefined,
        fromWallet: fromWalletAddr,
        toWallet: toWalletAddr,
        quoteWallet: quoteWallet ? quoteWallet.publicKey : undefined,
        // Auto close newly created open orders accounts.
        close: isClosingNewAccounts,
      });
    })();

    // If swapping SOL, then insert a wrap/unwrap instruction.
    if (isSol) {
      if (txs.length > 1) {
        throw new Error("SOL must be swapped in a single transaction");
      }
      const { tx: wrapTx, signers: wrapSigners } = await wrapSol(
        swapClient.program.provider,
        fromMint,
        amount,
        wrappedSolAccount as Keypair
      );
      const { tx: unwrapTx, signers: unwrapSigners } = unwrapSol(
        swapClient.program.provider,
        wrappedSolAccount!.publicKey
      );
      const tx = new Transaction();
      tx.add(wrapTx);
      tx.add(txs[0].tx);
      tx.add(unwrapTx);
      txs[0].tx = tx;
      txs[0].signers.push(...wrapSigners);
      txs[0].signers.push(...unwrapSigners);
    }
    await swapClient.program.provider.sendAll(txs);
  };

  if (disconnected) {
    return (
      <Button
        variant="contained"
        className={styles.swapButton}
        onClick={connectWalletCallback}
        disabled={!connectWalletCallback}
        style={swapButtonStyle}
      >
        {!!connectWalletCallback ? "Connect Wallet" : "Disconnected"}
      </Button>
    );
  }
  if (!isDexLoaded || !isTokensLoaded) {
    return (
      <Button
        variant="contained"
        className={styles.swapButton}
        onClick={sendSwapTransaction}
        disabled={true}
        style={swapButtonStyle}
      >
        Loading...
      </Button>
    );
  }

  return !fromWallet || insufficientBalance ? (
    <Button
      variant="contained"
      className={styles.swapButton}
      style={swapButtonStyle}
      disabled={true}
    >
      Insufficient balance
    </Button>
  ) : needsCreateAccounts ? (
    <Button
      variant="contained"
      className={styles.swapButton}
      onClick={sendCreateAccountsTransaction}
      disabled={!canCreateAccounts}
      style={swapButtonStyle}
    >
      Create Accounts
    </Button>
  ) : isWrapSol ? (
    <Button
      variant="contained"
      className={styles.swapButton}
      style={swapButtonStyle}
      onClick={sendWrapSolTransaction}
      disabled={!canWrapOrUnwrap}
    >
      Wrap SOL
    </Button>
  ) : isUnwrapSol ? (
    <Button
      variant="contained"
      className={styles.swapButton}
      onClick={sendUnwrapSolTransaction}
      style={swapButtonStyle}
      disabled={!canWrapOrUnwrap}
    >
      Unwrap SOL
    </Button>
  ) : isUnwrapSollet ? (
    <Button
      variant="contained"
      className={styles.swapButton}
      onClick={sendUnwrapSolletTransaction}
      disabled={fromAmount <= 0}
      style={swapButtonStyle}
    >
      Unwrap
    </Button>
  ) : minSwapAmount ? (
    <Button
      variant="contained"
      className={styles.swapButton}
      onClick={sendSwapTransaction}
      disabled={true}
      style={swapButtonStyle}
    >
      Min {minSwapAmount} Required
    </Button>
  ) : (
    <Button
      variant="contained"
      className={styles.swapButton}
      onClick={sendSwapTransaction}
      disabled={!canSwap}
      style={swapButtonStyle}
    >
      Swap
    </Button>
  );
}

// If wrappedSolAccount is undefined, then creates the account with
// an associated token account.
async function wrapSol(
  provider: Provider,
  fromMint: PublicKey,
  amount: BN,
  wrappedSolAccount?: Keypair
): Promise<{ tx: Transaction; signers: Array<Signer | undefined> }> {
  const tx = new Transaction();
  const signers = wrappedSolAccount ? [wrappedSolAccount] : [];
  let wrappedSolPubkey;
  // Create new, rent exempt account.
  if (wrappedSolAccount === undefined) {
    wrappedSolPubkey = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      fromMint,
      provider.wallet.publicKey
    );
    tx.add(
      Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        fromMint,
        wrappedSolPubkey,
        provider.wallet.publicKey,
        provider.wallet.publicKey
      )
    );
  } else {
    wrappedSolPubkey = wrappedSolAccount.publicKey;
    tx.add(
      SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: wrappedSolPubkey,
        lamports: await Token.getMinBalanceRentForExemptAccount(
          provider.connection
        ),
        space: 165,
        programId: TOKEN_PROGRAM_ID,
      })
    );
  }
  // Transfer lamports. These will be converted to an SPL balance by the
  // token program.
  if (fromMint.equals(SOL_MINT)) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: wrappedSolPubkey,
        lamports: amount.toNumber(),
      })
    );
  }
  // Initialize the account.
  tx.add(
    Token.createInitAccountInstruction(
      TOKEN_PROGRAM_ID,
      WRAPPED_SOL_MINT,
      wrappedSolPubkey,
      provider.wallet.publicKey
    )
  );
  return { tx, signers };
}

function unwrapSol(
  provider: Provider,
  wrappedSol: PublicKey
): { tx: Transaction; signers: Array<Signer | undefined> } {
  const tx = new Transaction();
  tx.add(
    Token.createCloseAccountInstruction(
      TOKEN_PROGRAM_ID,
      wrappedSol,
      provider.wallet.publicKey,
      provider.wallet.publicKey,
      []
    )
  );
  return { tx, signers: [] };
}
function getNewTokenAccountData(
  toAssociatedPubkey: PublicKey,
  mint: PublicKey,
  owner: PublicKey
): CachedToken {
  return {
    publicKey: toAssociatedPubkey,
    account: {
      address: toAssociatedPubkey,
      mint,
      owner,
      amount: new u64(0),
      delegate: null,
      delegatedAmount: new u64(0),
      isInitialized: true,
      isFrozen: false,
      isNative: false,
      rentExemptReserve: null,
      closeAuthority: null,
    },
  };
}
