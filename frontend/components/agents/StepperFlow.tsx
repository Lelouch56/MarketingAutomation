import {
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
  CircularProgress,
  Box,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { StepStatus } from '../../types';

interface Props {
  steps: StepStatus[];
}

function StepIconComponent({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircleIcon color="success" sx={{ fontSize: 22 }} />;
    case 'failed':
      return <ErrorIcon color="error" sx={{ fontSize: 22 }} />;
    case 'running':
      return <CircularProgress size={20} thickness={4} />;
    case 'skipped':
      return <SkipNextIcon color="disabled" sx={{ fontSize: 22 }} />;
    default:
      return <RadioButtonUncheckedIcon color="disabled" sx={{ fontSize: 22 }} />;
  }
}

function formatStepName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StepperFlow({ steps }: Props) {
  if (!steps || steps.length === 0) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Run the agent to see step-by-step progress.
        </Typography>
      </Box>
    );
  }

  const activeStep = steps.findIndex((s) => s.status === 'running');

  return (
    <Stepper
      activeStep={activeStep === -1 ? steps.length : activeStep}
      orientation="vertical"
      sx={{
        '& .MuiStepLabel-root': { py: 0.5 },
        '& .MuiStepConnector-line': { minHeight: 12 },
      }}
    >
      {steps.map((step) => (
        <Step key={step.step_number} completed={step.status === 'completed'}>
          <StepLabel
            error={step.status === 'failed'}
            StepIconComponent={() => <StepIconComponent status={step.status} />}
          >
            <Typography
              variant="body2"
              fontWeight={step.status === 'running' ? 600 : 400}
              color={
                step.status === 'failed'
                  ? 'error.main'
                  : step.status === 'completed'
                  ? 'success.main'
                  : step.status === 'running'
                  ? 'primary.main'
                  : 'text.secondary'
              }
            >
              {formatStepName(step.name)}
            </Typography>
          </StepLabel>
          {step.message && (
            <StepContent>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {step.message}
              </Typography>
            </StepContent>
          )}
        </Step>
      ))}
    </Stepper>
  );
}
