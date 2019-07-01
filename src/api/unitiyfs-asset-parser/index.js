var Parser = require('./binary_parser').Parser;
const lz4js = require('lz4js');
const dxt = require('./dxt');

// "polyfill" Buffer
var self = (typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
self.Buffer = self.Buffer ? self.Buffer : require('buffer/').Buffer;
var Buffer = self.Buffer;

var assetBundle = new Parser()
	.endianess('big')
	.string('signature', {  // "UnityFS"
		zeroTerminated: true
	})
	.int32('format_version') // 6
	.string('unity_version', { // "5.x.x"
		zeroTerminated: true
	})
	.string('generator_version', { // "2017.4.17f1"
		zeroTerminated: true
	})
	.int32('file_size1') //0
	.int32('file_size2') // 528862
	.uint32('ciblock_size') //64
	.uint32('uiblock_size') //91
	.uint32('flags') // 67
	.array('compressedBlk', { // byte[]
		type: "uint8",
		length: 'ciblock_size'
	})
	.array('assets', { // byte[]
		type: "uint8",
		readUntil: 'eof'
	});

var blockList = new Parser()
	.endianess('big')
	.skip(16)
	.int32('num_blocks') // 1
	.array('blocks', {
		type: Parser.start()
			.int32('busize') // 528748
			.int32('bcsize') // 528748
			.int16('bflags'), // 64
		length: 'num_blocks'
	})
	.int32('num_nodes') // 1
	.array('nodes', {
		type: Parser.start()
			.int32('ofs1') // 0
			.int32('ofs2') // 0
			.int32('size1') // 0
			.int32('size2') // 528748
			.int32('status') // 4
			.string('name', { // "CAB-d441eef4839431472fb997a38d8cbd42"
				zeroTerminated: true
			}),
		length: 'num_nodes'
	});

var typeParser = new Parser()
	.endianess('little')
	.int16('version')
	.uint8('depth')
	.uint8('is_array')
	.int32('typeOffset')
	.int32('nameOffset')
	.int32('size')
	.uint32('index')
	.int32('flags');

// FIXME: something is messed up here in the latest version. num_nodes is far too large
//        compared to the size of the buffer available, so the skip or something else
//        here must have changed; need to find the updated format or no more image parsing!
var typeTreeParser = new Parser()
	.endianess('little')
	.int32('class_id')
	.skip(function () { return (this.class_id < 0) ? 0x20 : 0x10; })
	.uint32('num_nodes')
	.uint32('buffer_bytes')
	.array('node_data', {
		type: typeParser,
		length: 'num_nodes'
	})
	.array('buffer_data', {
		type: 'uint8',
		length: 'buffer_bytes'
	});

var typeStructParser = new Parser()
	.endianess('little')
	.string('generator_version', {
		zeroTerminated: true
	})
	.uint32('target_platform')
	.uint8('has_type_trees')
	.int32('num_types')
	.array('types', {
		type: typeTreeParser,
		length: 'num_types'
	});

var assetParser = new Parser()
	.endianess('big')
	.uint32('metadata_size')
	.uint32('file_size')
	.uint32('format')
	.uint32('data_offset') // Hard-coded assume format > 9
	.uint32('endianness', { assert: 0 })
	.endianess('little')
	.nest('typeStruct', { type: typeStructParser })
	.uint32('num_objects')
	.array('objects', {
		type: Parser.start()
			.endianess('little')
			.skip(3) // TODO: Align at 4-byte instead of hardcode
			.int32('path_id1')
			.int32('path_id2')
			.uint32('data_offset')
			.uint32('size')
			.int32('type_id')
			.int16('class_id')
			.int16('unk1')
			.int8('unk2')
		,
		length: 'num_objects'
	})
	.uint32('num_adds', { assert: 0 })
	.uint32('num_refs', { assert: 0 })
	.string('unk_string', {
		zeroTerminated: true
	});

function alignOff(offset) {
	return (offset + 3) & -4;
}

function read_value(object, type, objectBuffer, offset) {
	let t = type.type;
	let align = false;
	let result;
	if (t == "bool") {
		result = objectBuffer.readUInt8(offset);
		offset += 1;
	}
	else if (t == "SInt8") {
		result = objectBuffer.readInt8(offset);
		offset += 1;
	}
	else if (t == "UInt8") {
		result = objectBuffer.readUInt8(offset);
		offset += 1;
	}
	else if (t == "SInt16") {
		result = objectBuffer.readInt16LE(offset);
		offset += 2;
	}
	else if (t == "UInt16") {
		result = objectBuffer.readUInt16LE(offset);
		offset += 2;
	}
	else if (t == "SInt64") {
		result = objectBuffer.readInt32LE(offset);
		let result2 = objectBuffer.readInt32LE(offset + 4);
		offset += 8;
	}
	else if (t == "UInt64") {
		result = objectBuffer.readUInt32LE(offset);
		let result2 = objectBuffer.readUInt32LE(offset + 4);
		offset += 8;
	}
	else if ((t == "UInt32") || (t == "unsigned") || (t == "unsigned int")) {
		result = objectBuffer.readUInt32LE(offset);
		offset += 4;
	}
	else if ((t == "SInt32") || (t == "int")) {
		result = objectBuffer.readInt32LE(offset);
		offset += 4;
	}
	else if (t == "float") {
		offset = alignOff(offset);
		result = objectBuffer.readFloatLE(offset);
		offset += 4;
	}
	else if (t == "string") {
		let size = objectBuffer.readUInt32LE(offset);
		offset += 4;
		result = String.fromCharCode.apply(null, objectBuffer.slice(offset, offset + size));

		if (size > 500)
			throw new RangeError('offset out of range');

		offset += size;
		align = type.children[0].post_align;
	}
	else {
		let first_child = (type.children.length > 0) ? type.children[0] : undefined;
		if (type.is_array) {
			first_child = type;
		}

		if (t.startsWith("PPtr<")) {
			result = {};

			result.file_id = objectBuffer.readInt32LE(offset);
			offset += 4;

			result.path_id = objectBuffer.readUInt32LE(offset);
			let resultpathid2 = objectBuffer.readUInt32LE(offset + 4);
			offset += 8;
		}
		else if (first_child && first_child.is_array) {
			align = first_child.post_align;
			let size = objectBuffer.readUInt32LE(offset);
			offset += 4;

			let array_type = first_child.children[1];
			if ((array_type.type == "char") || (array_type.type == "UInt8")) {
				result = objectBuffer.slice(offset, offset + size);
				offset += size;
			}
			else {
				result = [];
				for (let i = 0; i < size; i++) {
					let rVal = read_value(object, array_type, objectBuffer, offset);
					result.push(rVal.result);
					offset = rVal.offset;
				}
			}
		}
		else if (t == "pair") {
			console.assert(type.children.length == 2);
			first = read_value(object, type.children[0], objectBuffer, offset);
			offset = first.offset;
			second = read_value(object, type.children[1], objectBuffer, offset);
			offset = second.offset;
			result = { first: first.result, second: second.result };
		}
		else {
			// A dictionary
			result = {};

			type.children.forEach(child => {
				let rVal = read_value(object, child, objectBuffer, offset);
				result[child.name] = rVal.result;
				offset = rVal.offset;
			});

			if (t == "StreamedResource") {
				result.asset = result.source; // resolve_streaming_asset(result.source)
			}
			else if (t == "StreamingInfo") {
				result.asset = result.path; // resolve_streaming_asset(result.path)
			}
		}
	}

	if (align || type.post_align) {
		offset = alignOff(offset);
	}

	return { result, offset };
}

function parseAssetBundle(data) {
	var bundle = assetBundle.parse(Buffer.from(data));

	var decompressed = Buffer.alloc(bundle.uiblock_size);
	lz4js.decompressBlock(bundle.compressedBlk, decompressed, 0, bundle.ciblock_size, 0);
	var bundleBlocks = blockList.parse(decompressed);

	//var asset = assetParser.parse(Buffer.from(bundle.assets));
	var asset = assetParserGenerated(Buffer.from(bundle.assets));

	const strings = "AABB AnimationClip AnimationCurve AnimationState Array Base BitField bitset bool char ColorRGBA Component data deque double dynamic_array FastPropertyName first float Font GameObject Generic Mono GradientNEW GUID GUIStyle int list long long map Matrix4x4f MdFour MonoBehaviour MonoScript m_ByteSize m_Curve m_EditorClassIdentifier m_EditorHideFlags m_Enabled m_ExtensionPtr m_GameObject m_Index m_IsArray m_IsStatic m_MetaFlag m_Name m_ObjectHideFlags m_PrefabInternal m_PrefabParentObject m_Script m_StaticEditorFlags m_Type m_Version Object pair PPtr<Component> PPtr<GameObject> PPtr<Material> PPtr<MonoBehaviour> PPtr<MonoScript> PPtr<Object> PPtr<Prefab> PPtr<Sprite> PPtr<TextAsset> PPtr<Texture> PPtr<Texture2D> PPtr<Transform> Prefab Quaternionf Rectf RectInt RectOffset second set short size SInt16 SInt32 SInt64 SInt8 staticvector string TextAsset TextMesh Texture Texture2D Transform TypelessData UInt16 UInt32 UInt64 UInt8 unsigned int unsigned long long unsigned short vector Vector2f Vector3f Vector4f m_ScriptingClassIdentifier Gradient ";

	let getString = (offset, type) => {
		if (offset < 0) {
			offset &= 0x7fffffff;
			return strings.substring(offset, strings.indexOf(' ', offset));
		}
		else if (offset < type.buffer_bytes) {
			let tmp = type.buffer_data.slice(offset, type.buffer_data.indexOf(0, offset));
			return String.fromCharCode.apply(null, tmp);
		}
		else {
			return undefined;
		}
	};

	let buildTypeTree = (type) => {
		// This makes assumptions about the order in which the nodes are serialized
		var parents = [type.node_data[0]];
		var curr;

		type.node_data.forEach((node) => {
			node.type = getString(node.typeOffset, type);
			node.name = getString(node.nameOffset, type);
			node.children = [];
			node.post_align = node.flags & 0x4000;

			if (node.depth == 0) {
				curr = node;
			}
			else {
				while (parents.length > node.depth) {
					parents.pop();
				}
				curr = node;
				parents[parents.length - 1].children.push(curr);
				parents.push(curr);
			}
		});
	};

	asset.typeStruct.types.forEach((type) => { buildTypeTree(type); });

	// Read the standard / built-in typetrees (not really needed for images)
	/*var standardTypes = typeStructParser.parse(fs.readFileSync('structs.dat'));
	standardTypes.types.forEach((type) => { buildTypeTree(type); });*/

	let parsedObjects = [];
	asset.objects.forEach((object, index) => {
		var objectBuffer = Buffer.from(bundle.assets.slice(asset.data_offset + object.data_offset, asset.data_offset + object.data_offset + object.size));

		var type_tree = asset.typeStruct.types.find((type) => type.class_id == object.type_id);
		if (!type_tree) {
			type_tree = asset.typeStruct.types.find((type) => type.class_id == object.class_id);
			if (!type_tree) {
				//type_tree = standardTypes.types.find((type) => type.class_id == object.class_id);
				if (!type_tree) {
					console.error("Type tree not found for object " + index + "; class id: " + object.type_id);
					return undefined;
				}
			}
		}

		let parsedObject = read_value(object, type_tree.node_data[0], objectBuffer, 0).result;
		parsedObject.type = type_tree.node_data[0].type;

		parsedObjects.push(parsedObject);
	});

	// DONE parsing, now on to images

	let imageTexture = undefined;
	let hasSprites = false;
	parsedObjects.forEach(object => {
		if (object.type == 'Texture2D') {
			if ((object.m_TextureFormat != 10) && (object.m_TextureFormat != 12)) {
				console.error("Only supports DXT1 / DXT5 formats for images!");
				return undefined;
			}

			if (object.m_TextureFormat == 12) {
				object.rawBitmap = dxt.DXT5Decoder(object['image data'], object.m_Width, object.m_Height);
			}
			else {
				object.rawBitmap = dxt.DXT1Decoder(object['image data'], object.m_Width, object.m_Height);
			}
			delete object['image data'];
			console.assert(object.rawBitmap.length % 4 == 0);
			imageTexture = object;
		}
		if (object.type == 'Sprite') {
			hasSprites = true;
		}
	});

	if (!imageTexture) {
		console.log("No image in this asset bundle");
		console.log(parsedObjects);
		return undefined;
	}

	var result = {
		imageName: imageTexture.m_Name,
		imageBitmap: {
			data: imageTexture.rawBitmap,
			width: imageTexture.m_Width,
			height: imageTexture.m_Height
		},
		sprites: []
	};

	if (hasSprites) {
		parsedObjects.forEach(object => {
			if (object.type == 'Sprite') {
				console.assert(!object.m_IsPolygon, "Doesn't support polygonal sprites!");
				console.assert(object.m_Rect.x + object.m_Rect.width <= imageTexture.m_Width);
				console.assert(object.m_Rect.y + object.m_Rect.height <= imageTexture.m_Height);

				let spriteBitmap = Buffer.allocUnsafe(object.m_Rect.width * object.m_Rect.height * 4);
				for (let column = object.m_Rect.x; column < object.m_Rect.x + object.m_Rect.width; column++) {
					for (let row = object.m_Rect.y; row < object.m_Rect.y + object.m_Rect.height; row++) {
						let pixelLocation = (imageTexture.m_Height - 1 - row) * imageTexture.m_Width + column;
						imageTexture.rawBitmap.copy(spriteBitmap, ((object.m_Rect.height - 1 - row + object.m_Rect.y) * object.m_Rect.width + (column - object.m_Rect.x)) * 4, pixelLocation * 4, (pixelLocation + 1) * 4);
					}
				}

				result.sprites.push({
					spriteName: object.m_Name,
					spriteBitmap: {
						data: spriteBitmap,
						width: object.m_Rect.width,
						height: object.m_Rect.height,
					}
				});
			}
		});
	}

	return result;
}

function assetParserGenerated(buffer, callback, constructorFn) {
	var offset = 0;
	var vars = {};
	vars.metadata_size = buffer.readUInt32BE(offset);
	offset += 4;
	vars.file_size = buffer.readUInt32BE(offset);
	offset += 4;
	vars.format = buffer.readUInt32BE(offset);
	offset += 4;
	vars.data_offset = buffer.readUInt32BE(offset);
	offset += 4;
	vars.endianness = buffer.readUInt32BE(offset);
	offset += 4;
	vars.typeStruct = {};
	var $tmp0 = offset;
	while (buffer.readUInt8(offset++) !== 0);
	vars.typeStruct.generator_version = buffer.toString('utf8', $tmp0, offset - 1);
	vars.typeStruct.target_platform = buffer.readUInt32LE(offset);
	offset += 4;
	vars.typeStruct.has_type_trees = buffer.readUInt8(offset);
	offset += 1;
	vars.typeStruct.num_types = buffer.readInt32LE(offset);
	offset += 4;
	vars.typeStruct.types = [];
	for (var $tmp1 = 0; $tmp1 < vars.typeStruct.num_types; $tmp1++) {
		var $tmp2 = {};
		$tmp2.class_id = buffer.readInt32LE(offset);
		offset += 4;
		offset += (function () {
			return this.class_id < 0 ? 0x20 : 0x10;
		}).call($tmp2, vars);
		$tmp2.num_nodes = buffer.readUInt32LE(offset);
		offset += 4;
		$tmp2.buffer_bytes = buffer.readUInt32LE(offset);
		offset += 4;
		$tmp2.node_data = [];
		for (var $tmp3 = 0; $tmp3 < $tmp2.num_nodes; $tmp3++) {
			var $tmp4 = {};
			$tmp4.version = buffer.readInt16LE(offset);
			offset += 2;
			$tmp4.depth = buffer.readUInt8(offset);
			offset += 1;
			$tmp4.is_array = buffer.readUInt8(offset);
			offset += 1;
			$tmp4.typeOffset = buffer.readInt32LE(offset);
			offset += 4;
			$tmp4.nameOffset = buffer.readInt32LE(offset);
			offset += 4;
			$tmp4.size = buffer.readInt32LE(offset);
			offset += 4;
			$tmp4.index = buffer.readUInt32LE(offset);
			offset += 4;
			$tmp4.flags = buffer.readInt32LE(offset);
			offset += 4;
			$tmp2.node_data.push($tmp4);
		}
		$tmp2.buffer_data = [];
		for (var $tmp5 = 0; $tmp5 < $tmp2.buffer_bytes; $tmp5++) {
			var $tmp6 = buffer.readUInt8(offset);
			offset += 1;
			$tmp2.buffer_data.push($tmp6);
		}
		vars.typeStruct.types.push($tmp2);
	}
	vars.num_objects = buffer.readUInt32LE(offset);
	offset += 4;
	vars.objects = [];
	for (var $tmp7 = 0; $tmp7 < vars.num_objects; $tmp7++) {
		var $tmp8 = {};
		offset += 3;
		$tmp8.path_id1 = buffer.readInt32LE(offset);
		offset += 4;
		$tmp8.path_id2 = buffer.readInt32LE(offset);
		offset += 4;
		$tmp8.data_offset = buffer.readUInt32LE(offset);
		offset += 4;
		$tmp8.size = buffer.readUInt32LE(offset);
		offset += 4;
		$tmp8.type_id = buffer.readInt32LE(offset);
		offset += 4;
		$tmp8.class_id = buffer.readInt16LE(offset);
		offset += 2;
		$tmp8.unk1 = buffer.readInt16LE(offset);
		offset += 2;
		$tmp8.unk2 = buffer.readInt8(offset);
		offset += 1;
		vars.objects.push($tmp8);
	}
	vars.num_adds = buffer.readUInt32LE(offset);
	offset += 4;
	vars.num_refs = buffer.readUInt32LE(offset);
	offset += 4;
	var $tmp9 = offset;
	while (buffer.readUInt8(offset++) !== 0);
	vars.unk_string = buffer.toString('utf8', $tmp9, offset - 1);
	return vars;
}

module.exports = { parseAssetBundle };