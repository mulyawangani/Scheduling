export type OtherInfo = null | 'students' | 'teacher'

export type BehaviorCategory = {
  type: 'behavior' | 'hygiene'
  activity: string
  subActivities: string[]
  otherInfo: OtherInfo
}

export const BEHAVIOR_CATEGORIES: BehaviorCategory[] = [
  {
    type: 'behavior',
    activity: 'Self inflicted Activity',
    subActivities: ['Scratch self', 'Fall', 'Bitten', 'Run over', 'Splinter'],
    otherInfo: null,
  },
  {
    type: 'behavior',
    activity: 'Inflicting other students',
    subActivities: ['Scratching', 'Kicking or punching', 'Hitting friends', 'Pull someone hair'],
    otherInfo: 'students',
  },
  {
    type: 'behavior',
    activity: 'Injured by other students',
    subActivities: ['Got hit/kick', 'Got hair pulled'],
    otherInfo: 'students',
  },
  {
    type: 'behavior',
    activity: 'Inflicting teacher',
    subActivities: ['Hitting teacher', 'Scratching teacher'],
    otherInfo: 'teacher',
  },
  {
    type: 'hygiene',
    activity: 'Poo in toilet',
    subActivities: [],
    otherInfo: null,
  },
  {
    type: 'hygiene',
    activity: 'Pee in toilet',
    subActivities: [],
    otherInfo: null,
  },
  {
    type: 'hygiene',
    activity: 'Nose bleed',
    subActivities: [],
    otherInfo: null,
  },
  {
    type: 'hygiene',
    activity: 'Poo in pants',
    subActivities: [],
    otherInfo: null,
  },
  {
    type: 'hygiene',
    activity: 'Pee in pants',
    subActivities: [],
    otherInfo: null,
  },
]
