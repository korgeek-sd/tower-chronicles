import type {ClassId} from '../../game/classes/progression';

// User-visible profession names live outside the artwork. Keep IDs stable for
// server persistence; add translations here without changing saved class IDs.
export const ONBOARDING_CLASS_LABELS={
 ko:{warrior:'전사',mage:'마법사',archer:'궁수'},
 en:{warrior:'Warrior',mage:'Mage',archer:'Archer'}
} satisfies Record<'ko'|'en',Record<ClassId,string>>;

export type OnboardingClassLocale=keyof typeof ONBOARDING_CLASS_LABELS;
export function getOnboardingClassLabel(id:ClassId,locale:OnboardingClassLocale='ko'){
 return ONBOARDING_CLASS_LABELS[locale][id];
}
