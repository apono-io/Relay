import { Chip, Stack, Tooltip, Typography } from '@mui/material';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import type { GithubIdentity, IdentitySource } from '@/types/people';
import { SOURCE_HINTS, SOURCE_LABELS } from '@/types/people';

const SOURCE_ICONS: Record<IdentitySource, typeof VerifiedOutlinedIcon> = {
  GITHUB_OAUTH: VerifiedOutlinedIcon,
  MANUAL: EditOutlinedIcon,
  COMMIT_EMAIL: HelpOutlineOutlinedIcon,
};

const SOURCE_COLORS: Record<IdentitySource, 'success' | 'info' | 'warning'> = {
  GITHUB_OAUTH: 'success',
  MANUAL: 'info',
  COMMIT_EMAIL: 'warning',
};

export function IdentityChips({ identities }: { identities: GithubIdentity[] }) {
  if (identities.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No GitHub account yet
      </Typography>
    );
  }

  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {identities.map((identity) => {
        const Icon = SOURCE_ICONS[identity.source];
        return (
          <Tooltip key={identity.id} title={`${SOURCE_LABELS[identity.source]} — ${SOURCE_HINTS[identity.source]}`}>
            <Chip
              size="small"
              variant="outlined"
              color={SOURCE_COLORS[identity.source]}
              icon={<Icon sx={{ fontSize: 15 }} />}
              label={identity.login}
            />
          </Tooltip>
        );
      })}
    </Stack>
  );
}
