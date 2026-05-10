/**
 * 전역 폰트 설정
 *
 * Text/TextInput 컴포넌트의 기본 폰트를 NotoSansKR로 변경
 * fontWeight에 따라 자동으로 적절한 weight 폰트 선택
 *
 * 사용:
 *   _layout.tsx에서 폰트 로딩 후 setupGlobalFont() 호출
 *
 * 효과:
 *   <Text>일반 한글</Text>                       → NotoSansKR Regular
 *   <Text style={{ fontWeight: '700' }}>볼드</Text>  → NotoSansKR Bold
 *   <Text style={{ fontWeight: '500' }}>미디엄</Text> → NotoSansKR Medium
 *
 *   영문 잡지 제목은 명시적으로:
 *   <Text style={{ fontFamily: Fonts.display }}>Triplive</Text>
 */
import { Text, TextInput } from 'react-native';
import { Fonts } from '@/theme/theme';

const MEDIUM_WEIGHTS = ['500', '600'];
const BOLD_WEIGHTS = ['700', '800', '900', 'bold'];

function pickKrFont(weight?: any): string {
  const w = weight === undefined || weight === null ? '400' : String(weight);
  if (BOLD_WEIGHTS.includes(w)) return Fonts.bodyKrBold;
  if (MEDIUM_WEIGHTS.includes(w)) return Fonts.bodyKrMedium;
  return Fonts.bodyKr;
}

function extractWeight(style: any): any {
  if (!style) return undefined;
  if (Array.isArray(style)) {
    for (let i = style.length - 1; i >= 0; i--) {
      const w = extractWeight(style[i]);
      if (w !== undefined) return w;
    }
    return undefined;
  }
  return style?.fontWeight;
}

function hasExplicitFontFamily(style: any): boolean {
  if (!style) return false;
  if (Array.isArray(style)) {
    return style.some(hasExplicitFontFamily);
  }
  return !!style?.fontFamily;
}

export function setupGlobalFont() {
  patchComponent(Text);
  patchComponent(TextInput);
}

function patchComponent(Comp: any) {
  if (Comp.__fontPatched) return;

  const originalRender = Comp.render;

  if (typeof originalRender === 'function') {
    Comp.render = function patched(props: any, ref: any) {
      const userStyle = props?.style;

      if (!hasExplicitFontFamily(userStyle)) {
        const weight = extractWeight(userStyle);
        const fontFamily = pickKrFont(weight);
        const newProps = {
          ...props,
          style: [{ fontFamily }, userStyle],
        };
        return originalRender.call(this, newProps, ref);
      }

      return originalRender.call(this, props, ref);
    };
    Comp.__fontPatched = true;
    return;
  }

  Comp.defaultProps = Comp.defaultProps || {};
  const oldStyle = Comp.defaultProps.style;
  Comp.defaultProps.style = [{ fontFamily: Fonts.bodyKr }, oldStyle];
  Comp.__fontPatched = true;
}
