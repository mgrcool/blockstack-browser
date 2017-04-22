import ProfilesReducer from '../../../app/js/profiles/store/reducers.js'

describe('Profiles Store: ProfilesReducer', () => {
  it('should return the correct composed reducers', () => {
    const actualResult = ProfilesReducer(undefined, {})
    assert(actualResult.hasOwnProperty('identities'), 'Missing identities state.')
    assert(actualResult.hasOwnProperty('pgp'), 'Missing pgp state.')
    assert(actualResult.hasOwnProperty('search'), 'Missing search state.')
  })
})