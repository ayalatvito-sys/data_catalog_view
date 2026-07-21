import React from 'react';
import { Box, Typography, Chip, Divider } from '@mui/material';
import { ColumnProfile } from '../../types/profile';
import { profileTokens, getNullnessTone } from './profileTokens';
import MetricBar from './MetricBar';
import StatsPanel from './StatsPanel';
import TopValuesPanel from './TopValuesPanel';

interface ColumnCardProps {
  column: ColumnProfile;
}

/**
 * Card for a single column profile.
 *
 * Visual DNA inherited from DatasetCard:
 *  – white surface on #f8f9fa canvas
 *  – 1px #dadce0 border, borderRadius: 2 (matches MUI shape.borderRadius)
 *  – 4px transparent inline-start accent edge → semantic color on hover (RTL-logical)
 *  – same soft shadow + translateY(-2px) lift recipe
 *  – Heebo typography; monospace for identifiers
 *
 * The accent color is semantic: green (healthy) → amber (attention) → red (critical)
 * based on the column's null percentage, giving an instant data-quality signal.
 */
const ColumnCard: React.FC<ColumnCardProps> = ({ column }) => {
  const nullness = column.nullness || 0;
  const uniqueness = column.uniqueness || 0;
  const tone = getNullnessTone(nullness);

//   return (
//     <Box
//       sx={{
//         bgcolor: profileTokens.color.surface,
//         border: `1px solid ${profileTokens.color.border}`,
//         borderRadius: profileTokens.radius.card,
//         overflow: 'hidden',
//         // RTL-logical accent edge mirrors DatasetCard's borderRight pattern
//         borderInlineStart: '4px solid transparent',
//         transition: 'all 0.2s ease-in-out',
//         '&:hover': {
//           borderInlineStartColor: tone.main,
//           boxShadow: profileTokens.shadow.card,
//           transform: 'translateY(-2px)',
//         },
//       }}
//     >
//       <Box
//         sx={{
//           display: 'flex',
//           flexDirection: { xs: 'column', md: 'row' },
//           p: { xs: 2.5, md: 3 },
//           gap: { xs: 3, md: 4 },
//         }}
//       >
//         {/* ── Identity + headline metrics ─────────────────────────────── */}
//         <Box sx={{ width: { xs: '100%', md: 220 }, flexShrink: 0 }}>
//           <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
//             <Typography
//               variant="subtitle1"
//               sx={{
//                 fontWeight: 600,
//                 color: 'text.primary',
//                 fontFamily: profileTokens.font.mono,
//               }}
//             >
//               {column.column_name}
//             </Typography>
//           </Box>

//           {column.data_type !== 'UNKNOWN' && (
//             <Chip
//               label={column.data_type}
//               size="small"
//               variant="outlined"
//               sx={{ mb: 2.5, fontWeight: 500, fontFamily: profileTokens.font.mono }}
//             />
//           )}

//           <MetricBar
//             label="ערכים חסרים"
//             value={nullness}
//             color={tone.main}
//             tooltip={`רמת שלמות הנתונים: ${tone.label}`}
//           />
//           <MetricBar
//             label="ייחודיות"
//             value={uniqueness}
//             color={profileTokens.color.healthy}
//             tooltip="אחוז הערכים השונים מתוך כל הערכים בעמודה"
//           />
//         </Box>

//         <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

//         {/* ── Statistics ──────────────────────────────────────────────── */}
//         <Box sx={{ width: { xs: '100%', md: 260 }, flexShrink: 0 }}>
//           <Typography
//             variant="caption"
//             color="text.secondary"
//             sx={{
//               fontWeight: 600,
//               textTransform: 'uppercase',
//               letterSpacing: '0.04em',
//               display: 'block',
//               mb: 1.5,
//             }}
//           >
//             סטטיסטיקות
//           </Typography>
//           <StatsPanel column={column} />
//         </Box>

//         <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

//         {/* ── Top Values ──────────────────────────────────────────────── */}
//         <Box sx={{ flex: 1, minWidth: 0 }}>
//           <Typography
//             variant="caption"
//             color="text.secondary"
//             sx={{
//               fontWeight: 600,
//               textTransform: 'uppercase',
//               letterSpacing: '0.04em',
//               display: 'block',
//               mb: 1.5,
//             }}
//           >
//             ערכים נפוצים
//           </Typography>
//           <TopValuesPanel values={column.top_n} />
//         </Box>
//       </Box>
//     </Box>
//   );
// };

return (
    <Box
      sx={{
        bgcolor: profileTokens.color.surface,
        borderBottom: `1px solid ${profileTokens.color.border}`,
        transition: 'background-color 0.15s ease',
        '&:hover': {
          bgcolor: '#f8f9fa',
        },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          // חלוקה שווה לחלוטין של המקום במסך (50/50)
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
          gap: { xs: 3, md: 6 },
          p: { xs: 2.5, md: 3 },
          alignItems: 'start',
          maxWidth: '1400px', 
        }}
      >
        
        {/* ── עמודה 1: זהות ומדדים ── */}
        {/* 1. הקופסה החיצונית תופסת את כל החצי שלה */}
        <Box sx={{ width: '100%' }}>
          {/* 2. הקופסה הפנימית עוצרת את ההימרחות של הברים הירוקים/אדומים! */}
          <Box sx={{ maxWidth: '400px', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                  fontFamily: profileTokens.font.mono,
                  fontSize: '0.9rem',
                }}
              >
                {column.column_name}
              </Typography>
            </Box>

            {column.data_type !== 'UNKNOWN' && (
              <Chip
                label={column.data_type}
                size="small"
                variant="outlined"
                sx={{ 
                  mb: 3, 
                  fontWeight: 500, 
                  fontFamily: profileTokens.font.mono,
                  alignSelf: 'flex-start',
                  borderRadius: '4px'
                }}
              />
            )}

            <MetricBar
              label="ערכים חסרים"
              value={nullness}
              color={tone.main}
              tooltip={`רמת שלמות הנתונים: ${tone.label}`}
            />
            <MetricBar
              label="ייחודיות"
              value={uniqueness}
              color={profileTokens.color.healthy}
              tooltip="אחוז הערכים השונים מתוך כל הערכים בעמודה"
            />
          </Box>
        </Box>

        {/* ── עמודה 2: גרפים של ערכים נפוצים ── */}
        <Box sx={{ width: '100%' }}>
          
          <Box 
            sx={{ 
              maxWidth: '400px',
              width: '100%',
              // יישור טקסט עדין שלא שובר את הגרפים הכחולים
              textAlign: 'start',
              // אם הקומפוננטה הפנימית מנסה למרכז טקסט (כמו במצב ריק), אנחנו מיישרים רק את הטקסט ולא את הגריד
              '& .MuiTypography-root': {
                textAlign: 'start !important'
              }
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'block',
                mb: 1.5,
                fontSize: '0.75rem',
              }}
            >
              ערכים נפוצים
            </Typography>
            <TopValuesPanel values={column.top_n} />
          </Box>
          
        </Box>
      </Box>
    </Box>
  );
};

export default ColumnCard;
