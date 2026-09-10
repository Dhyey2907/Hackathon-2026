import { MOCK_STANDARDS } from "./mock-standards";

export type CatalogueStandard = (typeof MOCK_STANDARDS)[number] & {
  category: string;
  scheme: string;
};

const ADDITIONAL_STANDARDS: [string, string, string, number, string, string][] = [
  ["IS 694:2010", "PVC insulated cables for working voltages up to and including 1100 V", "ETD 9 (Cables and Wires)", 2010, "Electrical", "ISI Mark Scheme (Scheme-I)"],
  ["IS 7098 (Part 1):1988", "Cross-linked polyethylene insulated thermoplastic sheathed cables", "ETD 9 (Cables and Wires)", 1988, "Electrical", "ISI Mark Scheme (Scheme-I)"],
  ["IS 14255:1995", "Conductor for overhead power transmission", "ETD 9 (Cables and Wires)", 1995, "Electrical", "ISI Mark Scheme (Scheme-I)"],
  ["IS 302 (Part 2/Sec 3):2007", "Safety of household and similar electrical appliances: electric irons", "ETD 32 (Electrical Appliances)", 2007, "Electrical", "ISI Mark Scheme (Scheme-I)"],
  ["IS 302 (Part 2/Sec 80):2008", "Safety of household and similar electrical appliances: fans", "ETD 32 (Electrical Appliances)", 2008, "Electrical", "ISI Mark Scheme (Scheme-I)"],
  ["IS 13340:1993", "Electric storage water heaters", "ETD 32 (Electrical Appliances)", 1993, "Electrical", "ISI Mark Scheme (Scheme-I)"],
  ["IS 302 (Part 2/Sec 201):2009", "Safety of household and similar electrical appliances: electric blankets", "ETD 32 (Electrical Appliances)", 2009, "Electrical", "ISI Mark Scheme (Scheme-I)"],
  ["IS 616:2017", "Audio, video and similar electronic apparatus: safety requirements", "ETD 34 (Electronic Equipment)", 2017, "Electronics", "Compulsory Registration Scheme (CRS)"],
  ["IS 13252 (Part 1):2010", "Information technology equipment: safety requirements", "ETD 35 (IT Equipment)", 2010, "Electronics", "Compulsory Registration Scheme (CRS)"],
  ["IS 16046 (Part 1):2018", "Secondary cells and batteries containing alkaline or other non-acid electrolytes", "ETD 42 (Batteries)", 2018, "Batteries", "Compulsory Registration Scheme (CRS)"],
  ["IS 17017 (Part 1):2018", "Electric vehicle conductive supply equipment: general requirements", "ETD 51 (Electric Vehicles)", 2018, "EV charging", "ISI Mark Scheme (Scheme-I)"],
  ["IS 17017 (Part 2/Sec 1):2019", "Electric vehicle conductive supply equipment: AC charging stations", "ETD 51 (Electric Vehicles)", 2019, "EV charging", "ISI Mark Scheme (Scheme-I)"],
  ["IS 1199:1959", "Methods of sampling and analysis of concrete", "CED 2 (Cement and Concrete)", 1959, "Cement", "ISI Mark Scheme (Scheme-I)"],
  ["IS 4031 (Part 1):1996", "Methods of physical tests for hydraulic cement: fineness", "CED 2 (Cement and Concrete)", 1996, "Cement", "ISI Mark Scheme (Scheme-I)"],
  ["IS 4031 (Part 5):1988", "Methods of physical tests for hydraulic cement: soundness", "CED 2 (Cement and Concrete)", 1988, "Cement", "ISI Mark Scheme (Scheme-I)"],
  ["IS 1489 (Part 1):1991", "Portland-pozzolana cement: fly ash based", "CED 2 (Cement and Concrete)", 1991, "Cement", "ISI Mark Scheme (Scheme-I)"],
  ["IS 1786:2008", "High strength deformed steel bars and wires for concrete reinforcement", "MTD 4 (Wrought Steel Products)", 2008, "Steel", "ISI Mark Scheme (Scheme-I)"],
  ["IS 2062:2011", "Hot rolled medium and high tensile structural steel", "MTD 4 (Wrought Steel Products)", 2011, "Steel", "ISI Mark Scheme (Scheme-I)"],
  ["IS 2830:2012", "Carbon steel cast billets, blooms, slabs and bars for rerolling", "MTD 4 (Wrought Steel Products)", 2012, "Steel", "ISI Mark Scheme (Scheme-I)"],
  ["IS 1079:2017", "Hot rolled carbon steel sheet and strip", "MTD 4 (Wrought Steel Products)", 2017, "Steel", "ISI Mark Scheme (Scheme-I)"],
  ["IS 14272 (Part 1):1995", "Safety of toys: mechanical and physical properties", "PCH 12 (Toys)", 1995, "Toys", "ISI Mark Scheme (Scheme-I)"],
  ["IS 9873 (Part 1):2012", "Safety of toys: mechanical and physical properties", "PCH 12 (Toys)", 2012, "Toys", "ISI Mark Scheme (Scheme-I)"],
  ["IS 9873 (Part 3):2012", "Safety of toys: migration of certain elements", "PCH 12 (Toys)", 2012, "Toys", "ISI Mark Scheme (Scheme-I)"],
  ["IS 9873 (Part 7):2017", "Safety of toys: finger paints", "PCH 12 (Toys)", 2017, "Toys", "ISI Mark Scheme (Scheme-I)"],
  ["IS 2925:1984", "Industrial safety helmets", "CED 22 (Fire Fighting)", 1984, "Helmets", "ISI Mark Scheme (Scheme-I)"],
  ["IS 2925:1984", "Protective helmets for industrial workers", "CED 22 (Fire Fighting)", 1984, "Helmets", "ISI Mark Scheme (Scheme-I)"],
  ["IS 1179:1967", "Helmets for firemen", "CED 22 (Fire Fighting)", 1967, "Helmets", "ISI Mark Scheme (Scheme-I)"],
  ["IS 2925:2003", "Protective helmets for industrial use", "CED 22 (Fire Fighting)", 2003, "Helmets", "ISI Mark Scheme (Scheme-I)"],
  ["IS 10291:1982", "Safety requirements for industrial safety footwear", "CED 31 (Protective Clothing)", 1982, "PPE", "ISI Mark Scheme (Scheme-I)"],
  ["IS 15298 (Part 1):2011", "Personal protective equipment: safety footwear", "CED 31 (Protective Clothing)", 2011, "PPE", "ISI Mark Scheme (Scheme-I)"],
  ["IS 10500:2012", "Drinking water: specification", "FAD 14 (Drinks and Drinking Water)", 2012, "Food and water", "ISI Mark Scheme (Scheme-I)"],
  ["IS 4251:1967", "Quality tolerances for processed food products", "FAD 3 (Foodgrains)", 1967, "Food", "ISI Mark Scheme (Scheme-I)"],
  ["IS 2491:1972", "Code of hygienic practice for milk and milk products", "FAD 19 (Dairy Products)", 1972, "Food", "Food Safety Regulations"],
  ["IS 1607:1971", "Methods of test for edible oils and fats", "FAD 8 (Oilseeds and Fats)", 1971, "Food", "Food Safety Regulations"],
  ["IS 1483:1975", "Ready-to-eat foods: general requirements", "FAD 7 (Processed Foods)", 1975, "Food", "Food Safety Regulations"],
  ["IS 4984:2016", "Polyethylene pipes for water supply", "CED 50 (Plastic Piping Systems)", 2016, "Pipes", "ISI Mark Scheme (Scheme-I)"],
  ["IS 783:1985", "Code of practice for laying of concrete pipes", "CED 50 (Plastic Piping Systems)", 1985, "Pipes", "ISI Mark Scheme (Scheme-I)"],
  ["IS 3589:2001", "Steel pipes for water and sewage", "CED 19 (Water Supply)", 2001, "Pipes", "ISI Mark Scheme (Scheme-I)"],
  ["IS 303:1989", "Plywood for general purposes", "CED 20 (Wood Products)", 1989, "Plywood", "ISI Mark Scheme (Scheme-I)"],
  ["IS 710:2010", "Marine plywood", "CED 20 (Wood Products)", 2010, "Plywood", "ISI Mark Scheme (Scheme-I)"],
  ["IS 4990:2011", "Shuttering plywood for concrete formwork", "CED 20 (Wood Products)", 2011, "Plywood", "ISI Mark Scheme (Scheme-I)"],
  ["IS 1646:2015", "Code of practice for fire safety of electrical installations", "CED 36 (Fire Safety)", 2015, "Fire safety", "Fire Safety Code"],
  ["IS 2189:2008", "Selection, installation and maintenance of automatic fire detection systems", "CED 36 (Fire Safety)", 2008, "Fire safety", "Fire Safety Code"],
  ["IS 3039:1988", "Solar flat plate collector: requirements", "MED 4 (Non-Conventional Energy)", 1988, "Solar", "ISI Mark Scheme (Scheme-I)"],
  ["IS 12933 (Part 1):2003", "Solar water heating systems: collectors", "MED 4 (Non-Conventional Energy)", 2003, "Solar", "ISI Mark Scheme (Scheme-I)"],
  ["IS 13592:2012", "UPVC window and door frames", "CED 13 (Doors and Windows)", 2012, "Construction", "ISI Mark Scheme (Scheme-I)"],
  ["IS 15644:2006", "Safety of electric toys", "ETD 32 (Electrical Appliances)", 2006, "Toys", "ISI Mark Scheme (Scheme-I)"],
  ["IS 17068:2018", "Office and institutional furniture: general requirements", "CED 35 (Furniture)", 2018, "Furniture", "ISI Mark Scheme (Scheme-I)"],
  ["IS 17631:2021", "Footwear made from leather and synthetic materials", "TXD 30 (Footwear)", 2021, "Footwear", "ISI Mark Scheme (Scheme-I)"],
];

function tupleToStandard(entry: [string, string, string, number, string, string]): CatalogueStandard {
  const [is_number, title, committee, year, category, scheme] = entry;
  return {
    is_number,
    title,
    committee,
    division: category,
    year,
    status: "Current",
    category,
    scheme,
    scope: `Specifies requirements and applicable tests for ${title.toLowerCase().replace("specification", "the product")}.`,
    source_url: `https://www.bis.gov.in/standards/detail/${is_number.replace(/[^A-Za-z0-9]/g, "")}`,
  };
}

export const MOCK_CATALOGUE: CatalogueStandard[] = [
  ...MOCK_STANDARDS.map((standard) => ({
    ...standard,
    category: standard.division,
    scheme: standard.is_number.startsWith("IS 16102") ? "Compulsory Registration Scheme (CRS)" : "ISI Mark Scheme (Scheme-I)",
  })),
  ...ADDITIONAL_STANDARDS.map(tupleToStandard),
];

export function standardSlug(isNumber: string): string {
  return isNumber.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function getStandardBySlug(slug: string): CatalogueStandard | undefined {
  return MOCK_CATALOGUE.find((standard) => standardSlug(standard.is_number) === slug);
}