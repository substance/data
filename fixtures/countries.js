var countries_fixture = {
  "items": {
    "austria": {
      "name": "Austria",
      "official_language": "German Language",
      "form_of_government": [
        "Federal republic",
        "Parliamentary republic"
      ],
      "currency_used": "Euro",
      "population": 8356700,
      "gdp_nominal": 432400000000.0,
      "area": 83872.0,
      "date_founded": "1955-07-27"
    },
    "uk": {
      "name": "United Kingdom",
      "official_language": "English Language",
      "form_of_government": [
        "Parliamentary system",
        "Constitutional monarchy"
      ],
      "currency_used": "UK \u00a3",
      "population": 61612300,
      "gdp_nominal": 2787000000000.0,
      "area": 244820.0,
      "date_founded": "1707-05-01"
    },
    "usa": {
      "name": "United States of America",
      "official_language": "English Language",
      "form_of_government": [
        "Federal republic",
        "Constitution",
        "Democracy",
        "Republic",
        "Presidential system",
        "Constitutional republic"
      ],
      "currency_used": "US$",
      "population": 306108000,
      "gdp_nominal": 14330000000000.0,
      "area": 9826675.0,
      "date_founded": "1776-07-04"
    },
    "ger": {
      "name": "Germany",
      "official_language": "German Language",
      "form_of_government": [
        "Federal republic",
        "Democracy",
        "Parliamentary republic"
      ],
      "currency_used": "Euro",
      "population": 82062200,
      "gdp_nominal": 3818000000000.0,
      "area": 357092.9,
      "date_founded": "1949-05-23"
    },
    "fra": {
      "name": "France",
      "official_language": "French Language",
      "form_of_government": [
        "Republic",
        "Semi-presidential system"
      ],
      "currency_used": "Euro",
      "population": 65073482,
      "gdp_nominal": 2987000000000.0,
      "area": 674843.0,
      "date_founded": "1792"
    },
    "ita": {
      "name": "Italy",
      "official_language": "Italian Language",
      "form_of_government": [
        "Parliamentary republic"
      ],
      "currency_used": "Euro",
      "population": 60090400,
      "gdp_nominal": 2399000000000.0,
      "area": 301338.0,
      "date_founded": "1861-03-17"
    }
  },
  "properties": {
    "name": {
      "name": "Country Name",
      "type": "string",
      "unique": true
    },
    "official_language": {
      "name": "Official language",
      "type": "string",
      "unique": true
    },
    "form_of_government": {
      "name": "Form of governmennt",
      "type": "string",
      "unique": false
    },
    "currency_used": {
      "name": "Currency used",
      "type": "string",
      "unique": true
    },
    "population": {
      "name": "Population",
      "type": "number",
      "unique": true
    },
    "gdp_nominal": {
      "name": "GDP nominal",
      "type": "number",
      "unique": true
    },
    "area": {
      "name": "Area",
      "type": "number",
      "unique": true
    },
    "date_founded": {
      "name": "Date founded",
      "type": "date",
      "unqiue": true
    }
  }
}