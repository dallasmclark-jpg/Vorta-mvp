export interface SiteAccessGrant<Role extends string = string> {
  siteId: string;
  organisationId: string;
  role: Role;
  isDefault: boolean;
}

export function findAuthorisedSiteGrant<
  Role extends string,
>(
  grants: readonly SiteAccessGrant<Role>[],
  siteId: string | null | undefined,
): SiteAccessGrant<Role> | null {
  if (!siteId) {
    return null;
  }

  return grants.find((grant) => grant.siteId === siteId) ?? null;
}

export function chooseAuthorisedSiteGrant<
  Role extends string,
>(
  grants: readonly SiteAccessGrant<Role>[],
  storedSiteId: string | null | undefined,
): SiteAccessGrant<Role> | null {
  return (
    findAuthorisedSiteGrant(grants, storedSiteId) ??
    grants.find((grant) => grant.isDefault) ??
    grants[0] ??
    null
  );
}
