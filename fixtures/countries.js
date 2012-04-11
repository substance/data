var countries_fixture = {
  "type": {
    "_id": "/type/country",
    "name": "Countries",
    "properties": {
      "name": {"name": "Country Name", "type": "string" },
      "languages": {"name": "Languages spoken", "type": "string" },
      "population": { "name": "Population", "type": "number" },
      "gdp": { "name": "GDP per capita", "type": "number" }
    },
    "indexes": {
      "by_name": ["name"]
    }
  },
  "objects": [
    {
      "_id": "at",
      "name": "Austria",
      "languages": ["German", "Austrian"],
      "population": 8.3,
      "gdp": 41.805
    },
    {
      "_id": "de",
      "name": "Germany",
      "languages": ["German"],
      "population": 82,
      "gdp": 46.860
    },
    {
      "_id": "us",
      "name": "United States of America",
      "languages": ["German", "English", "Spanish", "Chinese", "French"],
      "population": 311,
      "gdp": 36.081
    },
    {
      "_id": "uk",
      "name": "United Kingdom",
      "languages": ["English", "Irish", "Scottish Gaelic"],
      "population": 62.3,
      "gdp": 36.081
    },
    {
      "_id": "es",
      "name": "Spain",
      "languages": ["Spanish"],
      "population": 30.6,
      "gdp": 36.081
    },
    {
      "_id": "gr",
      "name": "Greece",
      "languages": ["Greek"],
      "population": 11.0,
      "gdp": 36.081
    },
    {
      "_id": "ca",
      "name": "Canada",
      "languages": ["English", "French", "Spanish"],
      "population": 40.1,
      "gdp": 40.457
    }
  ]
};