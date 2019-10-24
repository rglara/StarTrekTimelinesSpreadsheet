import React from 'react';
import { SkillData } from '../../api/DTO';

export interface SkillCellProps {
	skill: SkillData;
	combined?: boolean;
	proficiency?: boolean;
	compactMode?: boolean;
}

export const SkillCell = (props:SkillCellProps) => {
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
