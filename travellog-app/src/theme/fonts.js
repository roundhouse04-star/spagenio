// Spagenio Travel - Typography
export const fonts = {
  serif: 'PlayfairDisplay_500Medium',
  serifBold: 'PlayfairDisplay_600SemiBold',
  serifItalic: 'PlayfairDisplay_400Regular_Italic',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansBold: 'Inter_600SemiBold',
};

export const typography = {
  // Headings (Playfair Display)
  h1: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 28, letterSpacing: -1, color: '#1E2A3A' },
  h2: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 22, letterSpacing: -0.5, color: '#1E2A3A' },
  h3: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 18, letterSpacing: -0.3, color: '#1E2A3A' },
  h4: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 16, color: '#1E2A3A' },
  
  // Caps labels
  capsSmall: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 1.8, color: '#9ca3af', textTransform: 'uppercase' },
  capsMedium: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 2, color: '#9ca3af', textTransform: 'uppercase' },
  capsLarge: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 2.5, color: '#1E2A3A', textTransform: 'uppercase' },
  
  // Body
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#1E2A3A', lineHeight: 20 },
  bodySmall: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6b7280', lineHeight: 18 },
  
  // Button
  button: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 2.5, color: '#ffffff', textTransform: 'uppercase' },
};
