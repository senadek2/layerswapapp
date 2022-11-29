import { useRouter } from 'next/router';
import { useFormWizardaUpdate } from '../../../../context/formWizardProvider';
import { FC, useCallback, useEffect, useState } from 'react'
import { useSwapDataState, useSwapDataUpdate } from '../../../../context/swap';
import { SwapCreateStep } from '../../../../Models/Wizard';
import SubmitButton from '../../../buttons/submitButton';
import toast from 'react-hot-toast';
import AddressDetails from '../../../DisclosureComponents/AddressDetails';
import NetworkSettings from '../../../../lib/NetworkSettings';
import WarningMessage from '../../../WarningMessage';
import SwapConfirmMainData from '../../../Common/SwapConfirmMainData';
import { ApiError, KnownwErrorCode } from '../../../../Models/ApiError';
import KnownInternalNames from '../../../../lib/knownIds';
import Widget from '../../Widget';
import LayerSwapApiClient, { SwapType } from '../../../../lib/layerSwapApiClient';
import useSWR from 'swr';
import { ApiResponse } from '../../../../Models/ApiResponse';
import GuideLink from '../../../guideLink';
import { useQueryState } from '../../../../context/query';
import InternalApiClient from '../../../../lib/internalApiClient';
import { useSettingsState } from '../../../../context/settings';

const OffRampSwapConfirmationStep: FC = () => {
    const { swapFormData, swap } = useSwapDataState()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { createAndProcessSwap, processPayment, updateSwapFormData } = useSwapDataUpdate()
    const { goToStep } = useFormWizardaUpdate<SwapCreateStep>()
    const { network } = swapFormData || {}
    const router = useRouter();
    const { exchange, destination_address, currency } = swapFormData || {}
    const query = useQueryState();
    const settings = useSettingsState();

    const layerswapApiClient = new LayerSwapApiClient()
    const depositad_address_endpoint = `${LayerSwapApiClient.apiBaseEndpoint}/api/exchange_accounts/${exchange?.baseObject?.internal_name}/deposit_address/${currency?.baseObject?.asset?.toUpperCase()}`
    const { data: deposite_address } = useSWR<ApiResponse<string>>((exchange && !destination_address) ? depositad_address_endpoint : null, layerswapApiClient.fetcher)

    useEffect(() => {
        if (deposite_address?.data)
            updateSwapFormData((old) => ({ ...old, destination_address: deposite_address.data }))
    }, [deposite_address])

    const handleSubmit = useCallback(async () => {
        setIsSubmitting(true)
        let nextStep: SwapCreateStep;
        try {
            if (!swap) {
                if (query.addressSource === "imxMarketplace" && settings.validSignatureisPresent) {
                    const accounts = await layerswapApiClient.GetNetworkAccounts(swapFormData.network.baseObject.internal_name)
                    if (!accounts?.data?.some(a => a.address === query.destAddress && a.is_verified)) {
                        const internalApiClient = new InternalApiClient()
                        await internalApiClient.VerifyWallet(window.location.search);
                    }
                }
                const swapId = await createAndProcessSwap();
                await router.push(`/${swapId}`)
            }
            else {
                const swapId = swap.id
                await processPayment(swapId)
                await router.push(`/${swapId}`)
            }
        }
        catch (error) {
            const data: ApiError = error?.response?.data?.error
            if (data?.code === KnownwErrorCode.INVALID_CREDENTIALS) {
                nextStep = SwapCreateStep.OffRampOAuth
            }
            else if (data?.message)
                toast.error(data?.message)
            else if (error.message)
                toast.error(error.message)
            else
                toast.error(error)
        }
        setIsSubmitting(false)
        if (nextStep)
            goToStep(nextStep)
    }, [network, swap, createAndProcessSwap, settings, query])

    return (
        <Widget>
            <Widget.Content>
                <SwapConfirmMainData>
                    {
                        NetworkSettings.KnownSettings[network?.baseObject?.internal_name]?.ConfirmationWarningMessage &&
                        <WarningMessage className='mb-4'>
                            <span>{NetworkSettings.KnownSettings[network?.baseObject?.internal_name]?.ConfirmationWarningMessage}.</span>
                            {
                                network?.baseObject?.internal_name == KnownInternalNames.Networks.LoopringMainnet &&
                                <GuideLink userGuideUrl='https://docs.layerswap.io/user-docs/using-gamestop-wallet-to-transfer-to-cex' text='Learn how' place='inStep' />
                            }
                        </WarningMessage>
                    }
                    <AddressDetails canEditAddress={false} />
                </SwapConfirmMainData>
            </Widget.Content>
            <Widget.Footer>
                <SubmitButton type='submit' isDisabled={false} isSubmitting={isSubmitting} onClick={handleSubmit}>
                    Confirm
                </SubmitButton>
            </Widget.Footer>
        </Widget>
    )
}

export default OffRampSwapConfirmationStep;
