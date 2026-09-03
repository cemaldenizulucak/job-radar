export type LocationCountry = {
  code: string;
  name: string;
};

export type LocationSubdivision = {
  code: string;
  name: string;
};

export type LocationCatalog = {
  countries: readonly LocationCountry[];
  subdivisionsByCountry: ReadonlyMap<string, readonly LocationSubdivision[]>;
};
