import { BigNumberish, Contract, Wallet } from 'ethers';
import {
    IInterchainToken,
    IInterchainToken__factory as IInterchainTokenFactory,
    ITokenManager,
    ITokenManager__factory as TokenManagerFactory,
} from './types';
import { Network, networks } from './Network';
import { relay } from './relay';

export interface ITS {
    registerCanonicalToken: (tokenAddress: string, wallet?: Wallet) => Promise<ITokenManager>;
    deployRemoteCanonicalToken: (
        tokenAddress: string,
        destinationChain: string | Network,
        gasValue?: BigNumberish,
        wallet?: Wallet
    ) => Promise<IInterchainToken>;
    deployInterchainToken: any;
    deployRemoteInterchainToken: any;
}

export async function setupITS(network: Network) {
    network.its = {} as any;
    network.its.registerCanonicalToken = async (tokenAddress: string, wallet: Wallet = network.ownerWallet) => {
        const service = network.interchainTokenService;
        const factory = network.interchainTokenFactory;
        await (await factory.connect(wallet).registerCanonicalInterchainToken(tokenAddress)).wait();
        const tokenId = await factory.canonicalInterchainTokenId(tokenAddress);
        const tokenManagerAddress = await service.tokenManagerAddress(tokenId);
        return TokenManagerFactory.connect(tokenManagerAddress, wallet);
    };

    network.its.deployRemoteCanonicalToken = async (
        tokenAddress: string,
        destinationChain: string | Network,
        gasValue: BigNumberish = BigInt(1e6),
        wallet: Wallet = network.ownerWallet
    ) => {
        const service = network.interchainTokenService;
        const factory = network.interchainTokenFactory;
        const tokenId = await factory.canonicalInterchainTokenId(tokenAddress);
        if (typeof destinationChain === 'string') {
            const destinationNetwork = networks.find((network) => network.name.toLowerCase() == (destinationChain as string).toLowerCase());
            if (destinationNetwork === null) throw new Error(`${destinationChain} is not a registered network.`);
            destinationChain = destinationNetwork as Network;
        }
        await (
            await factory
                .connect(wallet)
                .deployRemoteCanonicalInterchainToken('', tokenAddress, destinationChain.name, gasValue, { value: gasValue })
        ).wait();

        await relay();

        const interchainTokenAddress = await service.interchainTokenAddress(tokenId);
        return IInterchainTokenFactory.connect(interchainTokenAddress, destinationChain.provider);
    };

    network.its.deployInterchainToken = async (
        wallet: Wallet = network.ownerWallet,
        salt: string,
        name: string,
        symbol: string,
        decimals: BigNumberish,
        mintAmount: BigNumberish,
        distributor: string = wallet.address
    ) => {
        const factory = network.interchainTokenFactory;

        await (await factory.connect(wallet).deployInterchainToken(salt, name, symbol, decimals, mintAmount, distributor)).wait();
        const tokenAddress = await factory.interchainTokenAddress(wallet.address, salt);
        return IInterchainTokenFactory.connect(tokenAddress, wallet);
    };

    network.its.deployRemoteInterchainToken = async (
        wallet: Wallet = network.ownerWallet,
        salt: string,
        distributor: string,
        destinationChain: string | Network,
        gasValue: BigNumberish
    ) => {
        const factory = network.interchainTokenFactory;

        if (typeof destinationChain === 'string') {
            const destinationNetwork = networks.find((network) => network.name.toLowerCase() == (destinationChain as string).toLowerCase());
            if (destinationNetwork === null) throw new Error(`${destinationChain} is not a registered network.`);
            destinationChain = destinationNetwork as Network;
        }

        await (
            await factory
                .connect(wallet)
                .deployRemoteInterchainToken('', salt, distributor, destinationChain.name, gasValue, { value: gasValue })
        ).wait();

        await relay();

        const tokenAddress = await factory.interchainTokenAddress(wallet.address, salt);
        return IInterchainTokenFactory.connect(tokenAddress, destinationChain.provider);
    };
}
