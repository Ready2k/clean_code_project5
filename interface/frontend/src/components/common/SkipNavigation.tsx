import React from 'react';
import { Box, Button } from '@mui/material';
import { styled } from '@mui/material/styles';

const SkipLink = styled(Button)(({ theme }) => ({
  position: 'absolute',
  top: -40,
  left: 6,
  zIndex: 9999,
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  padding: theme.spacing(1, 2),
  textDecoration: 'none',
  borderRadius: theme.shape.borderRadius,
  fontSize: '0.875rem',
  fontWeight: 500,
  border: `2px solid ${theme.palette.primary.main}`,
  '&:focus': {
    top: 6,
    outline: `2px solid ${theme.palette.background.paper}`,
    outlineOffset: '2px',
  },
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
  },
}));

interface SkipNavigationProps {
  links?: Array<{
    href: string;
    label: string;
  }>;
}

const defaultLinks = [
  { href: '#main-content', label: 'Skip to main content' },
  { href: '#navigation', label: 'Skip to navigation' },
  { href: '#search', label: 'Skip to search' },
];

export const SkipNavigation: React.FC<SkipNavigationProps> = ({ 
  links = defaultLinks 
}) => {
  const handleSkipClick = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <Box
      component="nav"
      aria-label="Skip navigation links"
      sx={{ position: 'relative' }}
    >
      {links.map((link) => (
        <SkipLink
          key={link.href}
          onClick={() => handleSkipClick(link.href)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSkipClick(link.href);
            }
          }}
        >
          {link.label}
        </SkipLink>
      ))}
    </Box>
  );
};

export default SkipNavigation;