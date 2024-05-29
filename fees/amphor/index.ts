import ADDRESSES from '../../helpers/coreAssets.json'
import * as sdk from "@defillama/sdk";
import { ethers, EventFilter } from 'ethers';

import { Adapter, FetchResultFees } from "../../adapters/types";
import { CHAIN } from "../../helpers/chains";
import { ETHEREUM } from "../../helpers/chains";
import { getBlock } from "../../helpers/getBlock";


const AmphorILHedgedWSTETH_contractAddress: string = '0xcDC51F2B0e5F0906f2fd5f557de49D99c34Df54e';

const contractAbi: ethers.InterfaceAbi = [
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "lastSavedBalance",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "returnedAssets",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "fees",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "totalShares",
                "type": "uint256"
            }
        ],
        "name": "EpochEnd",
        "type": "event"
    },
]

const AmphorILHedgedWSTETH_contract: ethers.Contract = new ethers.Contract(AmphorILHedgedWSTETH_contractAddress, contractAbi);

const methodology = {
    UserFees: "Include performance fees.",
    Fees: "Includes all treasury revenue.",
    ProtocolRevenue: "Share of revenue going to Amphor treasury.",
    Revenue: "Sum of protocol revenue.",
}

interface ILog {
    address: string;
    data: string;
    transactionHash: string;
    topics: string[];
}

const data = async (timestamp: number): Promise<FetchResultFees> => {
    const toTimestamp = timestamp;
    const fromTimestamp = timestamp - 60 * 60 * 24;
    const toBlock = await getBlock(toTimestamp, CHAIN.ETHEREUM, {});


    const eventFilterWSTETH: EventFilter = {
        address: AmphorILHedgedWSTETH_contractAddress,
        topics: [ethers.id('EpochEnd(uint256,uint256,uint256,uint256,uint256)')]
    };

    const eventsWSTETH = (await sdk.getEventLogs({
        target: AmphorILHedgedWSTETH_contractAddress,
        topics: eventFilterWSTETH.topics as string[],
        fromBlock: 18535914,
        toBlock: toBlock,
        chain: CHAIN.ETHEREUM,
    })) as ethers.Log[];



    let totalRevenueWSTETH = BigInt(0);
    let totalFeesWSTETH = BigInt(0);



    let dailyFeesWSTETH = BigInt(0);
    let dailyRevenueWSTETH = BigInt(0);




    eventsWSTETH.forEach(res => {
        const event = AmphorILHedgedWSTETH_contract.interface.parseLog(res as any);
        totalRevenueWSTETH += BigInt(event!.args.returnedAssets) - BigInt(event!.args.lastSavedBalance)
        totalFeesWSTETH += BigInt(event!.args.fees)
        if (event!.args.timestamp > fromTimestamp && event!.args.timestamp < toTimestamp) {
            dailyFeesWSTETH += BigInt(event!.args.fees)
            dailyRevenueWSTETH = BigInt(event!.args.returnedAssets) - BigInt(event!.args.lastSavedBalance)
        }
    });


    const TOKENS = {
        amprETH: ADDRESSES.ethereum.amprETH,
    }
    const totalFees = new sdk.Balances({ chain: CHAIN.ETHEREUM, timestamp: toTimestamp });
    const totalRevenue = new sdk.Balances({ chain: CHAIN.ETHEREUM, timestamp: toTimestamp });
    const dailyFees = new sdk.Balances({ chain: CHAIN.ETHEREUM, timestamp: toTimestamp });
    const dailyRevenue = new sdk.Balances({ chain: CHAIN.ETHEREUM, timestamp: toTimestamp });

    totalFees.add(TOKENS.amprETH, totalFeesWSTETH.toString());

    totalRevenue.add(TOKENS.amprETH, totalRevenueWSTETH.toString());

    dailyFees.add(TOKENS.amprETH, dailyFeesWSTETH.toString());

    dailyRevenue.add(TOKENS.amprETH, dailyRevenueWSTETH.toString());


    const totalFeesNumber = Number(await totalFees.getUSDValue()).toFixed(0);
    const dailyRevenueNumber = Number(await dailyRevenue.getUSDValue()).toFixed(0);
    return {
        timestamp: timestamp,
        totalFees: totalFeesNumber,
        totalRevenue: Number(await totalRevenue.getUSDValue()).toFixed(0),
        totalProtocolRevenue: totalFeesNumber,
        totalUserFees: totalFeesNumber,
        dailyFees: Number(await dailyFees.getUSDValue()).toFixed(0),
        dailyProtocolRevenue: dailyRevenueNumber,
        dailyRevenue: dailyRevenueNumber,
    };
}

const adapter: Adapter = {
    adapter: {
        [ETHEREUM]: {
            fetch: data,
            start: 1713277007,
            meta: {
                methodology
            }
        }
    }
}

export default adapter;
