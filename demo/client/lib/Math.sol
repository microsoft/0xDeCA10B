pragma solidity ^0.6;

/**
 * @title Math
 * @dev Custom math operations.
 */
library Math {
    /**
     * @return The square root of `x` using the Babylonian method.
     */
    // Copied from https://github.com/ethereum/dapp-bin/pull/50 and modified slightly.
    function sqrt(uint x) internal pure returns (uint) {
        if (x == 0) return 0;
        else if (x <= 3) return 1;
        uint z = (x + 1) / 2;
        uint y = x;
        while (z < y)
        {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
}
