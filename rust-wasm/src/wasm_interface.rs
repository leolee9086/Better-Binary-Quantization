/// WASM接口层
/// 将Rust函数导出为JavaScript可调用的WASM函数

use wasm_bindgen::prelude::*;
use crate::vector_similarity::{SimilarityFunction, compute_similarity};
use crate::bitwise_dot_product::{
    compute_quantized_dot_product,
    compute_int4_bit_dot_product,
    compute_int1_bit_dot_product,
};
use crate::batch_dot_product::{
    compute_batch_four_bit_dot_product_direct_packed,
    compute_batch_one_bit_dot_product_direct_packed,
};
use crate::optimized_scalar_quantizer::{OptimizedScalarQuantizer, QuantizationResult};
use crate::binary_quantized_scorer::BinaryQuantizedScorer;

/// WASM: 计算向量相似性
/// 
/// # 参数
/// * `a` - Float32Array 向量a
/// * `b` - Float32Array 向量b
/// * `similarity_type` - 相似性类型: "euclidean" | "cosine" | "dot_product"
/// 
/// # 返回
/// 相似性分数
#[wasm_bindgen]
pub fn wasm_compute_similarity(
    a: &[f32],
    b: &[f32],
    similarity_type: &str,
) -> Result<f32, JsValue> {
    let sim_func = match similarity_type.to_lowercase().as_str() {
        "euclidean" => SimilarityFunction::Euclidean,
        "cosine" => SimilarityFunction::Cosine,
        "dot_product" | "maximum_inner_product" => SimilarityFunction::MaximumInnerProduct,
        _ => return Err(JsValue::from_str(&format!("不支持的相似性类型: {}", similarity_type))),
    };

    compute_similarity(a, b, sim_func)
        .map_err(|e| JsValue::from_str(&e))
}

/// WASM: 计算欧几里得距离
#[wasm_bindgen]
pub fn wasm_compute_euclidean_distance(a: &[f32], b: &[f32]) -> Result<f32, JsValue> {
    crate::vector_similarity::compute_euclidean_distance(a, b)
        .map_err(|e| JsValue::from_str(&e))
}

/// WASM: 计算余弦相似度
#[wasm_bindgen]
pub fn wasm_compute_cosine_similarity(a: &[f32], b: &[f32]) -> Result<f32, JsValue> {
    crate::vector_similarity::compute_cosine_similarity(a, b)
        .map_err(|e| JsValue::from_str(&e))
}

/// WASM: 计算点积
#[wasm_bindgen]
pub fn wasm_compute_dot_product(a: &[f32], b: &[f32]) -> f32 {
    crate::vector_utils::compute_dot_product(a, b)
}

/// WASM: 计算向量模长
#[wasm_bindgen]
pub fn wasm_compute_vector_magnitude(vector: &[f32]) -> f32 {
    crate::vector_utils::compute_vector_magnitude(vector)
}

/// WASM: 计算量化点积
#[wasm_bindgen]
pub fn wasm_compute_quantized_dot_product(q: &[u8], d: &[u8]) -> Result<i32, JsValue> {
    compute_quantized_dot_product(q, d)
        .map_err(|e| JsValue::from_str(&e))
}

/// WASM: 计算4位-1位点积
#[wasm_bindgen]
pub fn wasm_compute_int4_bit_dot_product(q: &[u8], d: &[u8]) -> Result<i32, JsValue> {
    compute_int4_bit_dot_product(q, d)
        .map_err(|e| JsValue::from_str(&e))
}

/// WASM: 计算1位-1位点积
#[wasm_bindgen]
pub fn wasm_compute_int1_bit_dot_product(q: &[u8], d: &[u8]) -> Result<i32, JsValue> {
    compute_int1_bit_dot_product(q, d)
        .map_err(|e| JsValue::from_str(&e))
}

/// WASM: 批量计算4位点积
#[wasm_bindgen]
pub fn wasm_compute_batch_four_bit_dot_product(
    query_vector: &[u8],
    continuous_buffer: &[u8],
    num_vectors: usize,
    dimension: usize,
) -> Vec<i32> {
    compute_batch_four_bit_dot_product_direct_packed(
        query_vector,
        continuous_buffer,
        num_vectors,
        dimension,
    )
}

/// WASM: 批量计算1位点积
#[wasm_bindgen]
pub fn wasm_compute_batch_one_bit_dot_product(
    query_vector: &[u8],
    continuous_buffer: &[u8],
    num_vectors: usize,
    packed_dimension: usize,
) -> Vec<i32> {
    compute_batch_one_bit_dot_product_direct_packed(
        query_vector,
        continuous_buffer,
        num_vectors,
        packed_dimension,
    )
}

/// WASM: 创建随机向量
#[wasm_bindgen]
pub fn wasm_create_random_vector(dimension: usize, min: f32, max: f32) -> Vec<f32> {
    crate::vector_utils::create_random_vector(dimension, min, max)
}

/// WASM: 创建零向量
#[wasm_bindgen]
pub fn wasm_create_zero_vector(dimension: usize) -> Vec<f32> {
    crate::vector_utils::create_zero_vector(dimension)
}

/// WASM包装类：向量
#[wasm_bindgen]
pub struct WasmVector {
    data: Vec<f32>,
}

#[wasm_bindgen]
impl WasmVector {
    #[wasm_bindgen(constructor)]
    pub fn new(data: Vec<f32>) -> WasmVector {
        WasmVector { data }
    }

    pub fn from_array(array: &[f32]) -> WasmVector {
        WasmVector {
            data: array.to_vec(),
        }
    }

    pub fn dimension(&self) -> usize {
        self.data.len()
    }

    pub fn get_data(&self) -> Vec<f32> {
        self.data.clone()
    }

    pub fn magnitude(&self) -> f32 {
        crate::vector_utils::compute_vector_magnitude(&self.data)
    }

    pub fn normalize(&mut self) {
        crate::vector_utils::normalize_vector(&mut self.data);
    }

    pub fn similarity(&self, other: &WasmVector, similarity_type: &str) -> Result<f32, JsValue> {
        let sim_func = match similarity_type.to_lowercase().as_str() {
            "euclidean" => SimilarityFunction::Euclidean,
            "cosine" => SimilarityFunction::Cosine,
            "dot_product" | "maximum_inner_product" => SimilarityFunction::MaximumInnerProduct,
            _ => return Err(JsValue::from_str(&format!("不支持的相似性类型: {}", similarity_type))),
        };

        compute_similarity(&self.data, &other.data, sim_func)
            .map_err(|e| JsValue::from_str(&e))
    }

    pub fn dot(&self, other: &WasmVector) -> f32 {
        crate::vector_utils::compute_dot_product(&self.data, &other.data)
    }
}

/// WASM包装类：量化结果
#[wasm_bindgen]
pub struct WasmQuantizationResult {
    pub lower_interval: f32,
    pub upper_interval: f32,
    pub additional_correction: f32,
    pub quantized_component_sum: f32,
}

#[wasm_bindgen]
impl WasmQuantizationResult {
    #[wasm_bindgen(constructor)]
    pub fn new(
        lower_interval: f32,
        upper_interval: f32,
        additional_correction: f32,
        quantized_component_sum: f32,
    ) -> WasmQuantizationResult {
        WasmQuantizationResult {
            lower_interval,
            upper_interval,
            additional_correction,
            quantized_component_sum,
        }
    }
}

/// WASM包装类：标量量化器
#[wasm_bindgen]
pub struct WasmScalarQuantizer {
    inner: OptimizedScalarQuantizer,
}

#[wasm_bindgen]
impl WasmScalarQuantizer {
    #[wasm_bindgen(constructor)]
    pub fn new(
        lambda: Option<f32>,
        iters: Option<usize>,
        similarity_type: Option<String>,
    ) -> Result<WasmScalarQuantizer, JsValue> {
        let sim_func = if let Some(st) = similarity_type {
            match st.to_lowercase().as_str() {
                "euclidean" => Some(SimilarityFunction::Euclidean),
                "cosine" => Some(SimilarityFunction::Cosine),
                "dot_product" | "maximum_inner_product" => Some(SimilarityFunction::MaximumInnerProduct),
                _ => return Err(JsValue::from_str(&format!("不支持的相似性类型: {}", st))),
            }
        } else {
            None
        };

        Ok(WasmScalarQuantizer {
            inner: OptimizedScalarQuantizer::new(lambda, iters, sim_func),
        })
    }

    /// 标量量化
    pub fn scalar_quantize(
        &self,
        vector: &[f32],
        bits: u8,
        centroid: &[f32],
    ) -> Result<JsValue, JsValue> {
        let mut destination = vec![0u8; vector.len()];
        let result = self.inner.scalar_quantize(vector, &mut destination, bits, centroid)
            .map_err(|e| JsValue::from_str(&e))?;

        // 返回包含量化向量和修正因子的对象
        let js_result = js_sys::Object::new();
        
        // 设置量化向量
        let js_destination = js_sys::Uint8Array::from(&destination[..]);
        js_sys::Reflect::set(&js_result, &JsValue::from_str("quantizedVector"), &js_destination)?;
        
        // 设置修正因子
        let js_correction = WasmQuantizationResult::new(
            result.lower_interval,
            result.upper_interval,
            result.additional_correction,
            result.quantized_component_sum,
        );
        js_sys::Reflect::set(&js_result, &JsValue::from_str("correction"), &JsValue::from(js_correction))?;

        Ok(js_result.into())
    }

    /// 二进制打包
    pub fn pack_as_binary(vector: &[u8]) -> Result<Vec<u8>, JsValue> {
        let packed_len = (vector.len() + 7) / 8;
        let mut packed = vec![0u8; packed_len];
        OptimizedScalarQuantizer::pack_as_binary(vector, &mut packed)
            .map_err(|e| JsValue::from_str(&e))?;
        Ok(packed)
    }
}

/// WASM包装类：二值量化评分器
#[wasm_bindgen]
pub struct WasmBinaryQuantizedScorer {
    inner: BinaryQuantizedScorer,
}

#[wasm_bindgen]
impl WasmBinaryQuantizedScorer {
    #[wasm_bindgen(constructor)]
    pub fn new(similarity_type: &str) -> Result<WasmBinaryQuantizedScorer, JsValue> {
        let sim_func = match similarity_type.to_lowercase().as_str() {
            "euclidean" => SimilarityFunction::Euclidean,
            "cosine" => SimilarityFunction::Cosine,
            "dot_product" | "maximum_inner_product" => SimilarityFunction::MaximumInnerProduct,
            _ => return Err(JsValue::from_str(&format!("不支持的相似性类型: {}", similarity_type))),
        };

        Ok(WasmBinaryQuantizedScorer {
            inner: BinaryQuantizedScorer::new(sim_func),
        })
    }

    /// 计算量化相似性分数
    pub fn compute_quantized_score(
        &self,
        quantized_query: &[u8],
        query_correction_lower: f32,
        query_correction_upper: f32,
        query_correction_additional: f32,
        query_correction_sum: f32,
        quantized_index: &[u8],
        index_correction_lower: f32,
        index_correction_upper: f32,
        index_correction_additional: f32,
        index_correction_sum: f32,
        query_bits: u8,
        dimension: usize,
        centroid_dp: f32,
    ) -> Result<f32, JsValue> {
        let query_corrections = QuantizationResult {
            lower_interval: query_correction_lower,
            upper_interval: query_correction_upper,
            additional_correction: query_correction_additional,
            quantized_component_sum: query_correction_sum,
        };

        let index_corrections = QuantizationResult {
            lower_interval: index_correction_lower,
            upper_interval: index_correction_upper,
            additional_correction: index_correction_additional,
            quantized_component_sum: index_correction_sum,
        };

        let result = self.inner.compute_quantized_score(
            quantized_query,
            &query_corrections,
            quantized_index,
            &index_corrections,
            query_bits,
            dimension,
            centroid_dp,
            None,
        ).map_err(|e| JsValue::from_str(&e))?;

        Ok(result.score)
    }
}
