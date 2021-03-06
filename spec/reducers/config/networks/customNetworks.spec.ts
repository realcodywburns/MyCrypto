import { CustomNetworkConfig } from 'types/network';
import { addCustomNetwork, removeCustomNetwork } from 'actions/config';
import { customNetworks } from 'reducers/config/networks/customNetworks';

const firstCustomNetwork: CustomNetworkConfig = {
  isCustom: true,
  id: '111',
  chainId: 111,
  name: 'First Custom Network',
  unit: 'customNetworkUnit',
  dPathFormats: null
};

const secondCustomNetwork: CustomNetworkConfig = {
  ...firstCustomNetwork,
  id: '222',
  chainId: 222,
  name: 'Second Custom Network'
};

const expectedState = {
  initialState: {},
  addFirstCustomNetwork: { [firstCustomNetwork.id]: firstCustomNetwork },
  addSecondCustomNetwork: {
    [firstCustomNetwork.id]: firstCustomNetwork,
    [secondCustomNetwork.id]: secondCustomNetwork
  },
  removeFirstCustomNetwork: { [secondCustomNetwork.id]: secondCustomNetwork }
};

const actions = {
  addFirstCustomNetwork: addCustomNetwork(firstCustomNetwork),
  addSecondCustomNetwork: addCustomNetwork(secondCustomNetwork),
  removeFirstCustomNetwork: removeCustomNetwork(firstCustomNetwork.id)
};

describe('custom networks reducer', () => {
  it('should return the intial state', () =>
    expect(customNetworks(undefined, {} as any)).toEqual(expectedState.initialState));

  it('should handle adding the first custom network', () =>
    expect(customNetworks(expectedState.initialState, actions.addFirstCustomNetwork)).toEqual(
      expectedState.addFirstCustomNetwork
    ));

  it('should handle adding the second custom network', () =>
    expect(
      customNetworks(expectedState.addFirstCustomNetwork, actions.addSecondCustomNetwork)
    ).toEqual(expectedState.addSecondCustomNetwork));

  it('should handle removing the first custom network', () =>
    expect(
      customNetworks(expectedState.addSecondCustomNetwork, actions.removeFirstCustomNetwork)
    ).toEqual(expectedState.removeFirstCustomNetwork));
});

export { actions as customNetworksActions, expectedState as customNetworksExpectedState };
