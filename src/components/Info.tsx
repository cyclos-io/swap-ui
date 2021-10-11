import {
  Box,
  Divider,
  IconButton,
  Link,
  makeStyles,
  Popover,
  Theme,
  Typography,
  useTheme,
} from "@material-ui/core";
import { InfoOutlined, SwapHorizRounded } from "@material-ui/icons";
import { PublicKey } from "@solana/web3.js";
import PopupState, { bindPopover, bindTrigger } from "material-ui-popup-state";
import {
  useBbo,
  useDexContext,
  useMarketName,
  usePriceImpact,
} from "../context/Dex";
import { useSwapFair, useSwapContext } from "../context/Swap";
import { useTokenInfo } from "../context/TokenList";
import { SettingsButton } from "./Settings";

const useStyles = makeStyles((theme: Theme) => ({
  infoLabel: {
    margin: theme.spacing(2),
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoButton: {
    marginLeft: "5px",
    padding: 0,
    fontSize: "14px",
  },
}));

export function InfoLabel() {
  const styles = useStyles();

  const {
    slippage,
    fromMint,
    toMint,
    showReversePrices,
    setShowReversePrices,
  } = useSwapContext();
  const fair = useSwapFair();
  const fromTokenInfo = useTokenInfo(fromMint);
  const toTokenInfo = useTokenInfo(toMint);

  // Use last route item to find impact
  const { route } = useDexContext();
  const impact = usePriceImpact(route?.markets?.at(-1));

  return (
    <Box my={2}>
      <div className={styles.infoLabel}>
        {/* 1 unit of from token */}
        <Typography
          color="textSecondary"
          align="center"
          style={{ fontSize: "14px", flex: 1 }}
        >
          {fair !== undefined && toTokenInfo && fromTokenInfo
            ? showReversePrices
              ? `1 ${fromTokenInfo.symbol}`
              : `1 ${toTokenInfo.symbol}`
            : `-`}
        </Typography>

        {/* Reverse direction button */}
        <IconButton
          color={showReversePrices ? "primary" : "default"}
          className={styles.infoButton}
          onClick={() => setShowReversePrices((p: any) => !p)}
        >
          <SwapHorizRounded />
        </IconButton>

        {/* Calculated amount of to token */}
        <Typography
          color="textSecondary"
          align="center"
          style={{ fontSize: "14px", flex: 1 }}
        >
          {fair !== undefined && toTokenInfo && fromTokenInfo
            ? showReversePrices
              ? `${(1 / fair).toFixed(toTokenInfo.decimals)} ${
                  toTokenInfo.symbol
                }`
              : `${fair.toFixed(fromTokenInfo.decimals)} ${
                  fromTokenInfo.symbol
                }`
            : `-`}
        </Typography>
      </div>
      <Divider />
      <div className={styles.infoLabel}>
        <Typography color="textSecondary" style={{ fontSize: "14px" }}>
          Price Impact:&nbsp;
        </Typography>
        <Typography
          style={{ fontSize: "14px", fontWeight: 500 }}
          display="inline"
          color={(impact ?? 0) > 10 ? "error" : "primary"}
        >
          {impact?.toFixed(2)}%
        </Typography>
      </div>
      <Divider />
      <div className={styles.infoLabel}>
        <Box display="flex" alignItems="center">
          <Typography color="textSecondary" style={{ fontSize: "14px" }}>
            Slippage Tolerance:&nbsp;
          </Typography>
          <SettingsButton />
        </Box>
        <Typography
          style={{ fontSize: "14px", fontWeight: 500 }}
          display="inline"
          color={(slippage ?? 0) > 10 ? "error" : "primary"}
        >
          {slippage?.toFixed(2)}%
        </Typography>
      </div>
    </Box>
  );
}

export function InfoButton({ route }: { route?: PublicKey[] }) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <PopupState variant="popover">
      {
        //@ts-ignore
        (popupState) => (
          <div style={{ display: "flex" }}>
            <IconButton
              {...bindTrigger(popupState)}
              className={styles.infoButton}
            >
              <InfoOutlined
                fontSize="small"
                htmlColor={theme.palette.primary.main}
              />
            </IconButton>
            <Popover
              {...bindPopover(popupState)}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "left",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              PaperProps={{ style: { borderRadius: "10px" } }}
              disableRestoreFocus
            >
              <InfoDetails route={route} />
            </Popover>
          </div>
        )
      }
    </PopupState>
  );
}

function InfoDetails({ route }: { route?: PublicKey[] }) {
  const { fromMint, toMint } = useSwapContext();
  const fromTokenInfo = useTokenInfo(fromMint);
  const toTokenInfo = useTokenInfo(toMint);

  const addresses = [
    { ticker: fromTokenInfo?.symbol, mint: fromMint },
    { ticker: toTokenInfo?.symbol, mint: toMint },
  ];

  return (
    <div style={{ padding: "15px", width: "250px" }}>
      <div>
        <Typography
          color="textSecondary"
          style={{ fontWeight: "bold", marginBottom: "5px" }}
        >
          Trade Route
        </Typography>
        {route ? (
          route.map((market: PublicKey) => {
            return <MarketRoute key={market.toString()} market={market} />;
          })
        ) : (
          <Typography color="textSecondary">Route not found</Typography>
        )}
      </div>
      <div style={{ marginTop: "15px" }}>
        <Typography
          color="textSecondary"
          style={{ fontWeight: "bold", marginBottom: "5px" }}
        >
          Tokens
        </Typography>
        {addresses.map((address) => {
          return (
            <div
              key={address.mint.toString()}
              style={{
                marginTop: "5px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <Link
                href={`https://explorer.solana.com/address/${address.mint.toString()}`}
                target="_blank"
                rel="noopener"
              >
                {address.ticker}
              </Link>
              <code style={{ width: "128px", overflow: "hidden" }}>
                {address.mint.toString()}
              </code>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MarketRoute({ market }: { market: PublicKey }) {
  const marketName = useMarketName(market);
  const bbo = useBbo(market);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: "5px",
      }}
    >
      <Link
        href={`https://dex.projectserum.com/#/market/${market.toString()}`}
        target="_blank"
        rel="noopener"
      >
        {marketName}
      </Link>
      <code style={{ marginLeft: "10px" }}>
        {bbo && bbo.mid ? bbo.mid.toFixed(6) : "-"}
      </code>
    </div>
  );
}
