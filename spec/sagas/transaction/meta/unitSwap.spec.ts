import { select, call, put } from 'redux-saga/effects';
import {
  getTokenTo,
  getTokenValue,
  getTo,
  getPreviousUnit,
  getValue,
  getDecimalFromUnit
} from 'selectors/transaction';
import { getToken } from 'selectors/wallet';
import { Wei, Address } from 'libs/units';
import {
  swapTokenToEther,
  swapEtherToToken,
  swapTokenToToken
} from 'actions/transaction/actionCreators/swap';
import { encodeTransfer } from 'libs/transaction';
import { bufferToHex } from 'ethereumjs-util';
import { rebaseUserInput, validateInput } from 'sagas/transaction/validationHelpers';
import { cloneableGenerator, SagaIteratorClone } from 'redux-saga/utils';
import { handleSetUnitMeta } from 'sagas/transaction/meta/unitSwap';
import { isNetworkUnit } from 'selectors/config';
import { SagaIterator } from 'redux-saga';
import BN from 'bn.js';
import { setSchedulingToggle } from 'actions/schedule';

const itShouldBeDone = (gen: SagaIterator) => {
  it('should be done', () => {
    expect(gen.next().done).toEqual(true);
  });
};

describe('handleSetUnitMeta*', () => {
  const expectedStart = (
    gen: SagaIterator,
    previousUnit: string,
    currentUnit: string,
    prevUnitIsNetworkUnit: boolean,
    currUnitIsNetworkUnit: boolean
  ) => {
    it('should select getPreviousUnit', () => {
      expect(gen.next().value).toEqual(select(getPreviousUnit));
    });

    it('should check if prevUnit is a network unit', () => {
      expect(gen.next(previousUnit).value).toEqual(select(isNetworkUnit, previousUnit));
    });

    it('should check if currUnit is a network unit', () => {
      expect(gen.next(prevUnitIsNetworkUnit).value).toEqual(select(isNetworkUnit, currentUnit));
    });

    it('should select getDeciimalFromUnit with currentUnit', () => {
      expect(gen.next(currUnitIsNetworkUnit).value).toEqual(
        select(getDecimalFromUnit, currentUnit)
      );
    });
  };

  describe('etherToEther', () => {
    const currentUnit = 'ETH';
    const previousUnit = 'ETH';
    const action: any = {
      payload: currentUnit
    };
    const gen = handleSetUnitMeta(action);

    expectedStart(gen, previousUnit, currentUnit, true, true);

    it('should return correctly', () => {
      expect(gen.next().value).toEqual(undefined);
    });

    itShouldBeDone(gen);
  });

  describe('tokenToEther', () => {
    const previousUnit = 'token';
    const currentUnit = 'ETH';
    const action: any = {
      payload: currentUnit
    };
    const decimal = 1;
    const tokenTo: any = 'tokenTo';
    const tokenValue: any = 'tokenValue';
    const raw = 'raw';
    const value: any = 'value';
    const gen = handleSetUnitMeta(action);

    expectedStart(gen, previousUnit, currentUnit, false, true);

    it('should select getTokenTo', () => {
      expect(gen.next(decimal).value).toEqual(select(getTokenTo));
    });

    it('should select getTokenValue', () => {
      expect(gen.next(tokenTo).value).toEqual(select(getTokenValue));
    });

    it('should call rebaseUserInput with tokenValue', () => {
      expect(gen.next(tokenValue).value).toEqual(call(rebaseUserInput, tokenValue));
    });

    it('should call validateInput with value and currentUnit', () => {
      expect(gen.next({ value, raw }).value).toEqual(call(validateInput, value, currentUnit));
    });

    it('should put swapTokenToEther', () => {
      expect(gen.next(true).value).toEqual(
        put(
          swapTokenToEther({
            to: tokenTo,
            value: {
              raw,
              value
            },
            decimal
          } as any)
        )
      );
    });

    itShouldBeDone(gen);
  });

  describe('etherToToken || tokenToToken', () => {
    const sharedLogicA = (gen: SagaIteratorClone, decimal: number, currentUnit: string) => {
      it('should select getToken with currentUnit', () => {
        expect(gen.next(decimal).value).toEqual(select(getToken, currentUnit));
      });

      it('should throw error if !currentToken', () => {
        const clone = gen.clone();
        expect(() => clone.next(false)).toThrowError('Could not find token during unit swap');
      });
    };

    const sharedLogicB = (
      gen: SagaIterator,
      input: string,
      raw: string,
      value: BN,
      currentUnit: string,
      isValid: boolean
    ) => {
      it('should call rebaseUserInput with input', () => {
        expect(gen.next(input).value).toEqual(call(rebaseUserInput, input as any));
      });

      it('should call validateInput with value and currentUnit', () => {
        expect(gen.next({ raw, value }).value).toEqual(call(validateInput, value, currentUnit));
      });

      it('should select getTo', () => {
        expect(gen.next(isValid).value).toEqual(select(getTo));
      });
    };

    const constructExpectedPayload = (
      data: Buffer,
      toAddress: string,
      raw: string,
      value: BN,
      decimal: number,
      tokenTo?: any
    ) => {
      const base = {
        data: { raw: bufferToHex(data), value: data },
        to: { raw: '', value: Address(toAddress) },
        tokenValue: { raw, value },
        decimal
      };
      if (!tokenTo) {
        return base;
      }
      return {
        ...base,
        tokenTo
      };
    };

    describe('etherToToken', () => {
      const previousUnit = 'ETH';
      const currentUnit = 'token';
      const action: any = {
        payload: currentUnit
      };
      const currentToken = {
        address: '0x0'
      };
      const decimal = 1;
      const input = 'input';
      const raw = 'raw';
      const value = Wei('100');
      const isValid = true;
      const to = { value: value.toBuffer() };

      const gens: any = {};
      gens.gen = cloneableGenerator(handleSetUnitMeta)(action);

      expectedStart(gens.gen, previousUnit, currentUnit, true, false);

      sharedLogicA(gens.gen, decimal, currentUnit);

      it('should select getValue', () => {
        expect(gens.gen.next(currentToken).value).toEqual(select(getValue));
      });

      sharedLogicB(gens.gen, input, raw, value, currentUnit, isValid);

      it('should put setSchedulingToogle', () => {
        expect(gens.gen.next(to).value).toEqual(
          put(
            setSchedulingToggle({
              value: false
            })
          )
        );
      });

      it('should put swapEtherToToken', () => {
        const data = encodeTransfer(to.value, value);
        const payload: any = constructExpectedPayload(
          data,
          currentToken.address,
          raw,
          value,
          decimal,
          to
        );

        expect(gens.gen.next(to).value).toEqual(put(swapEtherToToken(payload)));
      });

      itShouldBeDone(gens.gen);
    });

    describe('tokenToToken', () => {
      const previousUnit = 'token';
      const currentUnit = 'token';
      const action: any = {
        payload: currentUnit
      };
      const currentToken = {
        address: '0x1'
      };
      const decimal = 1;
      const input = 'input';
      const raw = 'raw';
      const value = Wei('100');
      const isValid = true;
      const to = { value: '0xa' };
      const tokenTo = { value: '0xb' };

      const gens: any = {};
      gens.gen = cloneableGenerator(handleSetUnitMeta)(action);

      expectedStart(gens.gen, previousUnit, currentUnit, false, false);

      sharedLogicA(gens.gen, decimal, currentUnit);

      it('should select getTokenValue', () => {
        expect(gens.gen.next(currentToken).value).toEqual(select(getTokenValue));
      });

      sharedLogicB(gens.gen, input, raw, value, currentUnit, isValid);

      it('should select getTokenTo', () => {
        expect(gens.gen.next(to).value).toEqual(select(getTokenTo));
      });

      it('should put swapEtherToToken', () => {
        const data = encodeTransfer(Address(tokenTo.value), value);
        const payload = constructExpectedPayload(data, currentToken.address, raw, value, decimal);
        expect(gens.gen.next(tokenTo).value).toEqual(put(swapTokenToToken(payload)));
      });

      itShouldBeDone(gens.gen);
    });
  });
});
