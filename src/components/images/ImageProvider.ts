import { ShipDTO, ImageDataDTO, FactionDTO } from "../../api/DTO";

export interface FoundResult<T> {
	id: T; // value supplied when a request is made
	url: string | undefined;
}

export interface IBitmap {
	width: number;
	height: number;
	data: Uint8Array;
}

export interface ImageCache {
	getImage(url: string): Promise<string|undefined>;
	saveImage(url: string, data: IBitmap): Promise<string>;
	getCached(url: string): string;
	formatUrl(url: string) : string;
}

// An interface to union the various DTOs that can define crew images, including CrewData, CrewAvatarDTO, and RewardDTO
export interface CrewImageData {
	full_body: ImageDataDTO;
	portrait: ImageDataDTO;
	name: string;
}

export interface ItemImageData {
	name: string;
	icon: ImageDataDTO;
	symbol: string;
	type: number;
	rarity: number;
}

export interface ImageProvider {
	getCrewImageUrl(crew: CrewImageData, fullBody: boolean): Promise<FoundResult<CrewImageData>>;
	getShipImageUrl(ship: ShipDTO): Promise<FoundResult<string>>;
	getItemImageUrl(item: ItemImageData, id: number): Promise<FoundResult<number>>;
	getFactionImageUrl(faction: FactionDTO, id: number): Promise<FoundResult<number>>;
	getSprite(assetName: string, spriteName: string, id: string): Promise<FoundResult<string>>;
	getImageUrl<T>(iconFile: string, id: T): Promise<FoundResult<T>>;
	getCached(withIcon: { icon?: ImageDataDTO }): string;
	getCrewCached(crew: CrewImageData, fullBody: boolean): string;
	getSpriteCached(assetName: string, spriteName: string): string;
}
