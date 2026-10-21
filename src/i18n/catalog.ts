import type { Locale } from "./config";
import type { Dictionary } from "./translate";
import frCore from "./locales/fr/core";
import frLearning from "./locales/fr/learning";
import frDevelopment from "./locales/fr/development";
import frManagement from "./locales/fr/management";
import frAdmin from "./locales/fr/admin";
import frClientCore from "./locales/fr/client-core";
import frClientLearning from "./locales/fr/client-learning";
import frClientDevelopment from "./locales/fr/client-development";
import frClientManagement from "./locales/fr/client-management";
import frClientAdmin from "./locales/fr/client-admin";
import frAdminOrg from "./locales/fr/admin-org";
import frErrors from "./locales/fr/errors";
import frClientAdminOrg from "./locales/fr/client-admin-org";
import arCore from "./locales/ar/core";
import arLearning from "./locales/ar/learning";
import arDevelopment from "./locales/ar/development";
import arManagement from "./locales/ar/management";
import arAdmin from "./locales/ar/admin";
import arClientCore from "./locales/ar/client-core";
import arClientLearning from "./locales/ar/client-learning";
import arClientDevelopment from "./locales/ar/client-development";
import arClientManagement from "./locales/ar/client-management";
import arClientAdmin from "./locales/ar/client-admin";
import arAdminOrg from "./locales/ar/admin-org";
import arErrors from "./locales/ar/errors";
import arClientAdminOrg from "./locales/ar/client-admin-org";

/**
 * Translations by area. Strings rendered by client components live in the client-* files: only those
 * are sent to the browser. English needs no dictionary (keys are English).
 */
const CLIENT: Record<Locale, Dictionary> = {
  en: {},
  fr: { ...frClientCore, ...frClientLearning, ...frClientDevelopment, ...frClientManagement, ...frClientAdmin, ...frClientAdminOrg },
  ar: { ...arClientCore, ...arClientLearning, ...arClientDevelopment, ...arClientManagement, ...arClientAdmin, ...arClientAdminOrg },
};

const SERVER: Record<Locale, Dictionary> = {
  en: {},
  fr: { ...frCore, ...frLearning, ...frDevelopment, ...frManagement, ...frAdmin, ...frAdminOrg, ...frErrors, ...CLIENT.fr },
  ar: { ...arCore, ...arLearning, ...arDevelopment, ...arManagement, ...arAdmin, ...arAdminOrg, ...arErrors, ...CLIENT.ar },
};

export const serverDictionary = (l: Locale) => SERVER[l];
export const clientDictionary = (l: Locale) => CLIENT[l];
