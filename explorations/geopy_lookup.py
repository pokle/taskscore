# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "geopy",
# ]
# ///

from geopy.geocoders import Nominatim

def lookup(location: str) -> None:
    print("================================")
    print(f"Looking up {location}")
    geolocator = Nominatim(user_agent="taskscore")
    location = geolocator.geocode(location)

    if location is None:
        print("Location not found\n")
        return

    print(f"location: {location}")
    print(f"formatted address: {location.address}")
    print(f"latitude: {location.latitude}")
    print(f"longitude: {location.longitude}")
    print(f"raw data: {location.raw}")
    print()


def main() -> None:
    lookup("Mt Elliot, Corryong, Victoria, Australia")
    lookup("Sydney, Australia")

if __name__ == "__main__":
    main()
