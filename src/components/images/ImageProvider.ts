import { ShipDTO, ImageDataDTO } from "../../api/DTO";

export interface IFoundResult {
	id: any; // value supplied when a request is made
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
}

// An interface to union the various DTOs that can define crew images, including CrewData, CrewAvatarDTO, and RewardDTO
export interface CrewImageData {
	full_body: ImageDataDTO;
	portrait: ImageDataDTO;
	name: string;
}

export interface ImageProvider {
	getCrewImageUrl(crew: CrewImageData, fullBody: boolean): Promise<IFoundResult>;
	getShipImageUrl(ship: ShipDTO): Promise<IFoundResult>;
	getItemImageUrl(item: any, id: number): Promise<IFoundResult>;
	getFactionImageUrl(faction: any, id: any): Promise<IFoundResult>;
	getSprite(assetName: string, spriteName: string, id: string): Promise<IFoundResult>;
	getImageUrl(iconFile: string, id: any): Promise<IFoundResult>;
	getCached(withIcon: { icon?: ImageDataDTO }): string;
	getCrewCached(crew: CrewImageData, fullBody: boolean): string;
	getSpriteCached(assetName: string, spriteName: string): string;
}
