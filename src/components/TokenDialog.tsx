import {
  Avatar,
  Badge,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grow,
  IconButton,
  List,
  ListItem,
  ListItemText,
  makeStyles,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@material-ui/core";
import { TransitionProps } from "@material-ui/core/transitions";
import { CloseRounded, Star, StarOutline } from "@material-ui/icons";
import { TokenInfo } from "@solana/spl-token-registry";
import { PublicKey } from "@solana/web3.js";
import { forwardRef, useState } from "react";
import { useOwnedTokenAccount, useTokenContext } from "../context/Token";
import {
  useSwappableTokens,
  useTokenBase,
  useTokenListContext,
} from "../context/TokenList";
import { TokenIcon } from "./Swap";

const useStyles = makeStyles((theme) => ({
  dialogContent: {
    padding: 0,
  },
  textField: {
    marginBottom: "8px",
  },
  tab: {
    minWidth: "134px",
  },
  tabSelected: {
    color: theme.palette.primary.contrastText,
    fontWeight: 700,
    backgroundColor: theme.palette.primary.main,
    borderRadius: "10px",
  },
  tabIndicator: {
    opacity: 0,
  },
  chip: {
    gap: theme.spacing(1),
  },
  selectTokenTitle: {
    paddingBottom: theme.spacing(2),
  },
  tokenSelector: {
    paddingTop: theme.spacing(1),
    paddingLeft: theme.spacing(0.5),
    display: "flex",
    width: "100%",
    cursor: "pointer",
  },
  closeIcon: {
    backgroundColor: theme.palette.text.secondary,
    color: theme.palette.getContrastText(theme.palette.text.secondary),
    fontSize: theme.spacing(1.5),
    borderRadius: "50%",
    padding: theme.spacing(0.3),
  },
  badge: {},
}));

const Transition = forwardRef(function Transition(
  props: TransitionProps & { children?: React.ReactElement<any, any> },
  ref: React.Ref<unknown>
) {
  return <Grow ref={ref} {...props} />;
});

export default function TokenDialog({
  open,
  onClose,
  setMint,
}: {
  open: boolean;
  onClose: () => void;
  setMint: (mint: PublicKey) => void;
}) {
  const [tabSelection, setTabSelection] = useState(0);
  const [tokenFilter, setTokenFilter] = useState("");
  const filter = tokenFilter.toLowerCase();
  const styles = useStyles();
  const { swappableTokens, swappableTokensSollet, swappableTokensWormhole } =
    useSwappableTokens();
  const { tokenBase, addNewBase, tokenBaseMap, removeBase } = useTokenBase();
  const displayTabs = !useMediaQuery("(max-width:450px)");
  const selectedTokens =
    tabSelection === 0
      ? swappableTokens
      : tabSelection === 1
      ? swappableTokensWormhole
      : swappableTokensSollet;
  let tokens =
    tokenFilter === ""
      ? selectedTokens
      : selectedTokens.filter(
          (t) =>
            t.symbol.toLowerCase().startsWith(filter) ||
            t.name.toLowerCase().startsWith(filter) ||
            t.address.toLowerCase().startsWith(filter)
        );
  return (
    <Dialog
      open={open}
      onClose={onClose}
      scroll={"paper"}
      TransitionComponent={Transition}
      PaperProps={{
        style: {
          borderRadius: "10px",
          maxWidth: "420px",
          maxHeight: "clamp(100px, 80vh, 1000px)",
        },
      }}
    >
      <DialogTitle style={{ fontWeight: "bold" }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          className={styles.selectTokenTitle}
        >
          <Typography variant="h6">Select a token</Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseRounded />
          </IconButton>
        </Box>
        {/* Token search */}
        <TextField
          className={styles.textField}
          autoFocus
          placeholder={"Search name"}
          value={tokenFilter}
          size="small"
          fullWidth
          variant="outlined"
          onChange={(e) => setTokenFilter(e.target.value)}
        />

        <Typography variant="caption">Common bases</Typography>
        {/* Common token */}
        {tokenBase?.length != 0 && (
          <CommonBases
            commonTokenBases={tokenBase}
            removeBase={removeBase}
            onClick={(mint) => {
              setMint(mint);
              onClose();
            }}
          />
        )}
      </DialogTitle>
      <DialogContent className={styles.dialogContent} dividers={true}>
        <List disablePadding>
          {tokens.map((tokenInfo: TokenInfo) => (
            <TokenListItem
              key={tokenInfo.address}
              tokenInfo={tokenInfo}
              onClick={(mint) => {
                setMint(mint);
                onClose();
              }}
              addNewBase={(token) => {
                addNewBase(token);
              }}
              isCommonBase={
                tokenBaseMap.get(tokenInfo.address.toString()) ? true : false
              }
              removeBase={(token) => {
                removeBase(token);
              }}
            />
          ))}
        </List>
      </DialogContent>
      {displayTabs && (
        <DialogActions>
          <Tabs
            value={tabSelection}
            onChange={(e, v) => setTabSelection(v)}
            classes={{
              indicator: styles.tabIndicator,
            }}
          >
            <Tab
              value={0}
              className={styles.tab}
              classes={{ selected: styles.tabSelected }}
              label="Main"
            />
            <Tab
              value={1}
              className={styles.tab}
              classes={{ selected: styles.tabSelected }}
              label="Wormhole"
            />
            <Tab
              value={2}
              className={styles.tab}
              classes={{ selected: styles.tabSelected }}
              label="Sollet"
            />
          </Tabs>
        </DialogActions>
      )}
    </Dialog>
  );
}

function TokenListItem({
  tokenInfo,
  onClick,
  addNewBase,
  removeBase,
  isCommonBase,
}: {
  tokenInfo: TokenInfo;
  onClick: (mint: PublicKey) => void;
  addNewBase: (token: TokenInfo) => void;
  removeBase: (token: TokenInfo) => void;
  isCommonBase: Boolean;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const { userTokens } = useTokenContext();
  const mint = new PublicKey(tokenInfo.address);

  // const { ownedTokensDetailed } = useTokenListContext();
  // const details = ownedTokensDetailed.filter(
  //   (t) => t.address === tokenInfo.address
  // )?.[0];
  // const details = userTokens?.[tokenInfo.address]
  const details = useOwnedTokenAccount(mint);

  return (
    <ListItem button>
      <div onClick={() => onClick(mint)} className={styles.tokenSelector}>
        <TokenIcon
          mint={mint}
          style={{ width: theme.spacing(4), height: theme.spacing(4) }}
        />
        <TokenName tokenInfo={tokenInfo} />
      </div>
      {/* Token quantity and price */}
      {details?.tokenAmount && details.tokenAmount > 0 && (
        <Box mr={1} textAlign="end">
          <ListItemText
            primary={details?.tokenAmount}
            secondary={`$${details?.tokenAmount * (details?.priceUsdt ?? 0)}`}
          />
        </Box>
      )}
      {/* Add to favourites button */}
      <IconButton
        size="small"
        onClick={() =>
          isCommonBase ? removeBase(tokenInfo) : addNewBase(tokenInfo)
        }
      >
        {isCommonBase ? (
          <Star fontSize="small" />
        ) : (
          <StarOutline fontSize="small" />
        )}
      </IconButton>
      {/* {+details?.tokenAmount ? (
        <Box mr={1} textAlign="end">
          <ListItemText
            primary={details?.balance}
            secondary={`$${details?.usd}`}
          />
        </Box>
      ) : (
        // Add as common base button
        <IconButton
          size="small"
          onClick={() =>
            isCommonBase ? removeBase(tokenInfo) : addNewBase(tokenInfo)
          }
        >
          {isCommonBase ? (
            <Star fontSize="small" />
          ) : (
            <StarOutline fontSize="small" />
          )}
        </IconButton>
      )} */}
    </ListItem>
  );
}

function TokenName({ tokenInfo }: { tokenInfo: TokenInfo }) {
  return (
    <div style={{ marginLeft: "16px" }}>
      <Typography style={{ fontWeight: "bold" }}>
        {tokenInfo?.symbol}
      </Typography>
      <Typography color="textSecondary" style={{ fontSize: "14px" }}>
        {tokenInfo?.name}
      </Typography>
    </div>
  );
}

function CommonBases({
  commonTokenBases,
  onClick,
  removeBase,
}: {
  commonTokenBases: TokenInfo[] | undefined;
  onClick: (mint: PublicKey) => void;
  removeBase: (token: TokenInfo) => void;
}) {
  const styles = useStyles();

  const [hovered, setHovered] = useState("");

  return (
    <Box display="flex" flexWrap="wrap" className={styles.chip}>
      {commonTokenBases?.map((tokenInfo: TokenInfo) => {
        const mint = new PublicKey(tokenInfo.address);
        return (
          <Box
            onMouseEnter={() => {
              setHovered(tokenInfo?.symbol);
            }}
            onMouseLeave={() => {
              setHovered("");
            }}
          >
            <Badge
              badgeContent={
                <CloseRounded
                  className={styles.closeIcon}
                  onClick={() => removeBase(tokenInfo)}
                />
              }
              className={styles.badge}
              invisible={hovered !== tokenInfo?.symbol}
            >
              <Chip
                key={tokenInfo.address}
                avatar={
                  <Avatar alt={tokenInfo?.name} src={tokenInfo?.logoURI} />
                }
                variant="outlined"
                label={tokenInfo?.symbol}
                onClick={() => onClick(mint)}
                style={{ borderRadius: 4 }}
              />
            </Badge>
          </Box>
        );
      })}
    </Box>
  );
}
