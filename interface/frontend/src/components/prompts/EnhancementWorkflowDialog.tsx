import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  Close as CloseIcon,
} from '@mui/icons-material';
import { PromptRecord } from '../../types/prompts';
import { EnhancementProgress } from '../../types/enhancement';
import { EnhancementInitiation } from './enhancement/EnhancementInitiation';
import { EnhancementProgressTracker } from './enhancement/EnhancementProgressTracker';
import { EnhancementQuestionnaire } from './enhancement/EnhancementQuestionnaire';
import { EnhancementResults } from './enhancement/EnhancementResults';
import { createLogger } from '../../utils/logger';

interface EnhancementWorkflowDialogProps {
  open: boolean;
  prompt: PromptRecord | null;
  onClose: () => void;
  onApprove?: (promptId: string, enhancementResult: any) => void;
}

const logger = createLogger('EnhancementWorkflowDialog');

export const EnhancementWorkflowDialog: React.FC<EnhancementWorkflowDialogProps> = ({
  open,
  prompt,
  onClose,
  onApprove,
}) => {
  logger.debug('Rendering', { open, prompt: !!prompt });
  
  const [currentStep, setCurrentStep] = React.useState(0);
  const [activeJob, setActiveJob] = React.useState<EnhancementProgress | null>(null);

  React.useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      logger.debug('Resetting state (dialog closed)');
      setCurrentStep(0);
      setActiveJob(null);
    }
  }, [open]);

  const handleEnhancementStarted = (jobId: string, promptId: string) => {
    logger.info('Enhancement started', { jobId, promptId });
    setActiveJob({
      jobId,
      promptId,
      status: 'pending',
      progress: 0,
      message: 'Enhancement job started',
    });
    setCurrentStep(1); // Move to progress tracking
  };

  const handleProgressUpdate = (progress: EnhancementProgress) => {
    logger.debug('Progress update received', { 
      status: progress.status, 
      hasResult: !!progress.result,
      hasQuestions: !!progress.result?.questions,
      currentStep 
    });
    
    setActiveJob(progress);
    
    // Move to questionnaire step if questions are generated
    if (progress.status === 'generating_questions' && progress.result?.questions) {
      logger.info('Moving to questionnaire step');
      setCurrentStep(2);
    }
    
    // Move to results step if enhancement is complete
    if (progress.status === 'completed' && progress.result) {
      logger.info('Moving to results step', { 
        resultType: typeof progress.result,
        resultKeys: Object.keys(progress.result || {})
      });
      setCurrentStep(3);
    }
  };

  const handleQuestionnaireSubmitted = () => {
    // Stay on progress tracking while processing questionnaire
    setCurrentStep(1);
  };

  const handleApprove = () => {
    if (prompt && activeJob?.result) {
      onApprove?.(prompt.id, activeJob.result);
      onClose();
    }
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setActiveJob(null);
  };

  const steps = [
    {
      label: 'Configure Enhancement',
      description: 'Select provider and enhancement options',
    },
    {
      label: 'Processing',
      description: 'AI is analyzing and enhancing your prompt',
    },
    {
      label: 'Additional Information',
      description: 'Provide answers to improve the enhancement',
    },
    {
      label: 'Review Results',
      description: 'Review and approve the enhanced prompt',
    },
  ];

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <EnhancementInitiation
            prompt={prompt}
            onEnhancementStarted={handleEnhancementStarted}
          />
        );
      case 1:
        return (
          <EnhancementProgressTracker
            job={activeJob}
            onProgressUpdate={handleProgressUpdate}
          />
        );
      case 2:
        return (
          <EnhancementQuestionnaire
            job={activeJob}
            onSubmitted={handleQuestionnaireSubmitted}
          />
        );
      case 3:
        return (
          <EnhancementResults
            prompt={prompt}
            job={activeJob}
            onApprove={handleApprove}
            onRestart={handleRestart}
          />
        );
      default:
        return null;
    }
  };

  if (!prompt) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h5" component="h2">
              AI Enhancement Workflow
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {prompt.metadata.title}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 3 }}>
          <Stepper activeStep={currentStep} orientation="vertical">
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>
                  <Typography variant="h6">{step.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {step.description}
                  </Typography>
                </StepLabel>
                <StepContent>
                  <Box sx={{ mt: 2, mb: 1 }}>
                    {getStepContent(index)}
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose}>
          {currentStep === 3 ? 'Close' : 'Cancel'}
        </Button>
        {currentStep === 3 && activeJob?.result && (
          <Button
            variant="contained"
            onClick={handleApprove}
          >
            Approve Enhancement
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};