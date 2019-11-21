import React from 'react';
import { SkillData, CrewDTO, CrewData } from '../../api/DTO';
import { RarityStars, CONFIG } from '../../api';

/**
 * Shows a <div> of <span>s with optional voy/combined or core, optional proficiency.
 * Suited for use in table cells.
 */
export const SkillCell = (props: {
	skill: SkillData;
	combined?: boolean;
	proficiency?: boolean;
	compactMode?: boolean;
}) => {
	if (props.skill.core > 0) {
		let out = <span className='skill-stats'>{props.skill.core}</span>;
		let range = <span className='skill-stats-range'>+({props.skill.min} - {props.skill.max})</span>;
		if (props.combined) {
			out = <span className='skill-stats'>{props.skill.voy}</span>;
		}
		if (props.proficiency) {
			out = range;
		}
		if (props.compactMode) {
			return <div className='skill-stats-div'>{out}</div>;
		} else {
			return <div className='skill-stats-div'>{out}</div>;
		}
	}
	else {
		return <div className='skill-stats-div'></div>;
	}
}

/**
 * Show all nonzero crew skills by icon or text
 */
export const CrewSkills = (props: {
	crew: CrewData,
	useIcon?: boolean,
	hideProf?: boolean,
	asVoyScore?: boolean,
	addVoyTotal?: boolean
	addScore?: number
}) => {
	const crew = props.crew;
	return <span key={crew.id}>
		<RarityStars max={crew.max_rarity} value={crew.rarity} asSpan={true} colored={true} />
		&nbsp;
		{ Object.keys(CONFIG.SKILLS).map(s => {
			// BorrowedCrewDTO and CrewDTO will have missing skills or unknown voy skills
			if (!crew.skills[s] || crew.skills[s].voy === undefined || crew.skills[s].voy <= 0) {
				return <span key={s} />;
			}
			return <span key={s}>{
				props.useIcon ?
					<img src={CONFIG.SPRITES['icon_' + s].url} height={18} />
					: <span>{' - '}{CONFIG.SKILLS_SHORT[s]}{' '}</span>
				}
				{
					props.asVoyScore ?
						crew.skills[s].voy :
						(props.hideProf ?
							crew.skills[s].core :
							(crew.skills[s].core + ' (' + crew.skills[s].min + '-'  + crew.skills[s].max + ')'))
				}
				</span>;
		})}
		{
			props.addVoyTotal && <span key='v'>{' - '}
				Voy {Object.keys(CONFIG.SKILLS).map(s => crew.skills[s].voy).reduce((acc,c) => acc + c, 0)}
			</span>
		}
		{
			props.addScore !== undefined && <span key='s'>{' - '}{props.addScore}</span>
		}
	</span>;
}
