import { createStep, createWorkflow, WorkflowResponse, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ADDRESS_TR_MODULE } from "../modules/address-tr"
import AddressTrService from "../modules/address-tr/service"

const PROVINCES = [
    { plate_code: 1, name: "Adana" }, { plate_code: 2, name: "Adıyaman" }, { plate_code: 3, name: "Afyonkarahisar" },
    { plate_code: 4, name: "Ağrı" }, { plate_code: 5, name: "Amasya" }, { plate_code: 6, name: "Ankara" },
    { plate_code: 7, name: "Antalya" }, { plate_code: 8, name: "Artvin" }, { plate_code: 9, name: "Aydın" },
    { plate_code: 10, name: "Balıkesir" }, { plate_code: 11, name: "Bilecik" }, { plate_code: 12, name: "Bingöl" },
    { plate_code: 13, name: "Bitlis" }, { plate_code: 14, name: "Bolu" }, { plate_code: 15, name: "Burdur" },
    { plate_code: 16, name: "Bursa" }, { plate_code: 17, name: "Çanakkale" }, { plate_code: 18, name: "Çankırı" },
    { plate_code: 19, name: "Çorum" }, { plate_code: 20, name: "Denizli" }, { plate_code: 21, name: "Diyarbakır" },
    { plate_code: 22, name: "Edirne" }, { plate_code: 23, name: "Elazığ" }, { plate_code: 24, name: "Erzincan" },
    { plate_code: 25, name: "Erzurum" }, { plate_code: 26, name: "Eskişehir" }, { plate_code: 27, name: "Gaziantep" },
    { plate_code: 28, name: "Giresun" }, { plate_code: 29, name: "Gümüşhane" }, { plate_code: 30, name: "Hakkâri" },
    { plate_code: 31, name: "Hatay" }, { plate_code: 32, name: "Isparta" }, { plate_code: 33, name: "Mersin" },
    { plate_code: 34, name: "İstanbul" }, { plate_code: 35, name: "İzmir" }, { plate_code: 36, name: "Kars" },
    { plate_code: 37, name: "Kastamonu" }, { plate_code: 38, name: "Kayseri" }, { plate_code: 39, name: "Kırklareli" },
    { plate_code: 40, name: "Kırşehir" }, { plate_code: 41, name: "Kocaeli" }, { plate_code: 42, name: "Konya" },
    { plate_code: 43, name: "Kütahya" }, { plate_code: 44, name: "Malatya" }, { plate_code: 45, name: "Manisa" },
    { plate_code: 46, name: "Kahramanmaraş" }, { plate_code: 47, name: "Mardin" }, { plate_code: 48, name: "Muğla" },
    { plate_code: 49, name: "Muş" }, { plate_code: 50, name: "Nevşehir" }, { plate_code: 51, name: "Niğde" },
    { plate_code: 52, name: "Ordu" }, { plate_code: 53, name: "Rize" }, { plate_code: 54, name: "Sakarya" },
    { plate_code: 55, name: "Samsun" }, { plate_code: 56, name: "Siirt" }, { plate_code: 57, name: "Sinop" },
    { plate_code: 58, name: "Sivas" }, { plate_code: 59, name: "Tekirdağ" }, { plate_code: 60, name: "Tokat" },
    { plate_code: 61, name: "Trabzon" }, { plate_code: 62, name: "Tunceli" }, { plate_code: 63, name: "Şanlıurfa" },
    { plate_code: 64, name: "Uşak" }, { plate_code: 65, name: "Van" }, { plate_code: 66, name: "Yozgat" },
    { plate_code: 67, name: "Zonguldak" }, { plate_code: 68, name: "Aksaray" }, { plate_code: 69, name: "Bayburt" },
    { plate_code: 70, name: "Karaman" }, { plate_code: 71, name: "Kırıkkale" }, { plate_code: 72, name: "Batman" },
    { plate_code: 73, name: "Şırnak" }, { plate_code: 74, name: "Bartın" }, { plate_code: 75, name: "Ardahan" },
    { plate_code: 76, name: "Iğdır" }, { plate_code: 77, name: "Yalova" }, { plate_code: 78, name: "Karabük" },
    { plate_code: 79, name: "Kilis" }, { plate_code: 80, name: "Osmaniye" }, { plate_code: 81, name: "Düzce" }
]

const seedProvincesStep = createStep(
    "seed-provinces",
    async (_, { container }) => {
        const addressTrService: AddressTrService = container.resolve(ADDRESS_TR_MODULE)
        const results = []
        for (const p of PROVINCES) {
            const [existing] = await addressTrService.listTrProvinces({ plate_code: p.plate_code })
            if (!existing) {
                const province = await addressTrService.createTrProvinces(p)
                results.push(province)
            }
        }
        return new StepResponse(results)
    }
)

export const seedTrAddressesWorkflow = createWorkflow(
    "seed-tr-addresses",
    () => {
        const provinces = seedProvincesStep()
        return new WorkflowResponse(provinces)
    }
)
